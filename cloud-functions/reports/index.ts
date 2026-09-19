/**
 * Report archive — Blob storage at the Functions layer.
 *
 *   POST /reports                  { caseId, filename, markdown }  → stores the report, returns { key, url }
 *   GET  /reports?key=CASE-…/x.md  → downloads one report
 *   GET  /reports                  → lists archived reports
 *
 * Uses @edgeone/pages-blob with strong consistency, so a report is readable immediately after it is written.
 * Inputs are validated (case-id shape, file-name charset, size cap) and reports are served as text downloads.
 */
import { getStore } from "@edgeone/pages-blob";

const MAX_CHARS = 60_000;
const CASE_ID = /^CASE-[A-Za-z0-9-]{3,60}$/;
const KEY = /^CASE-[A-Za-z0-9-]{3,60}\/[A-Za-z0-9._-]{1,80}$/;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" },
  });
}

export async function onRequest(context: { request: Request }) {
  const request = context.request;
  // Inside Makers Functions the project id and token are injected by the platform (per the Blob docs);
  // the SDK's type definitions still list them as required, hence the cast.
  const store = getStore({ name: "case-reports", consistency: "strong" } as unknown as Parameters<typeof getStore>[0]);

  try {
    if (request.method === "POST") {
      const body = (await request.json()) as { caseId?: unknown; filename?: unknown; markdown?: unknown };
      if (typeof body.caseId !== "string" || !CASE_ID.test(body.caseId)) return json({ error: "invalid caseId" }, 400);
      if (typeof body.markdown !== "string" || body.markdown.length === 0 || body.markdown.length > MAX_CHARS) {
        return json({ error: "markdown must be a non-empty string under 60k characters" }, 400);
      }
      const safeName = String(body.filename ?? "report.md").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "report.md";
      const key = `${body.caseId}/${safeName}`;
      await store.set(key, body.markdown);
      return json({ ok: true, key, url: `/reports?key=${encodeURIComponent(key)}` });
    }

    const key = new URL(request.url).searchParams.get("key");
    if (key) {
      if (!KEY.test(key)) return json({ error: "invalid key" }, 400);
      const text = await store.get(key);
      if (text == null) return json({ error: "not found" }, 404);
      return new Response(String(text), {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${key.split("/")[1]}"`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const { blobs } = await store.list({ prefix: "CASE-" });
    return json({ reports: blobs.map(b => ({ key: b.key, url: `/reports?key=${encodeURIComponent(b.key)}` })) });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}
