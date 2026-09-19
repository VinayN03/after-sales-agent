import type { AgentContext } from '@edgeone/types';
/**
 * Generate an audit report for a case with the sandbox tool, archive it in Blob storage, and
 * remember it on the case. Runs through the tool registry, so the call is permission-checked
 * (agent "audit" is granted "sandbox.report") and appears in the case's tool-call trace.
 */
import { archiveReport, buildCaseReport } from "../_agents/sandbox-tools";
import { getCase, saveCase } from "../_agents/store";
import { runTool } from "../_agents/tools";
import { withLocalFallbackStore } from "../_local-store";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" },
  });
}

export async function onRequest(rawContext: AgentContext) {
  const context = withLocalFallbackStore(rawContext);
  const body = (context.request?.body ?? {}) as Record<string, unknown>;
  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  if (!caseId) return json({ error: "Expected { caseId }" }, 400);

  const c = await getCase(context, caseId);
  if (!c) return json({ error: `Case ${caseId} not found` }, 404);

  const report = await runTool(c, "audit", "sandbox.report", () => buildCaseReport(context, c));
  const archived = await archiveReport(context, c.caseId, report);
  if (archived) report.archived = archived;

  c.report = report;
  await saveCase(context, c);
  return json({ report, toolCalls: c.toolCalls ?? [] });
}
