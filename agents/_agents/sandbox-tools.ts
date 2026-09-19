import type { AgentContext } from '@edgeone/types';
/**
 * Sandbox tool: build an audit report for a case by running code in the platform sandbox
 * (`context.sandbox` — shell + files + code execution in an isolated container), then archive it
 * in Blob storage through the Functions layer (cloud-functions/reports).
 *
 * Isolation model:
 *  - the code that runs is fixed and authored here — never model-generated or built from user text;
 *  - case data goes in as a JSON *file* (never interpolated into code or a shell command);
 *  - the sandbox is handed no secrets: no env vars, no gateway key, no credentials;
 *  - hard timeout and output cap.
 * If the sandbox is unavailable (local dev, outage) a TypeScript fallback renders the same report and
 * the result says so, so the feature degrades instead of failing.
 */
import { createLogger } from "../_shared";
import { siteOrigin } from "./python-service";
import type { Case, CaseReport } from "./types";

const logger = createLogger("sandbox-tools");
const SANDBOX_TIMEOUT_S = 20;
const MAX_REPORT_CHARS = 20_000;

/** The minimal slice of context.sandbox this tool uses (see the Makers sandbox docs). */
interface SandboxLike {
  files: { write(path: string, content: string): Promise<unknown> };
  commands: { run(cmd: string, opts?: { timeout?: number; cwd?: string }): Promise<{ stdout?: string; stderr?: string; exitCode?: number }> };
}

/** Fixed report generator executed inside the sandbox. Reads the case JSON file, prints Markdown. */
const REPORT_SCRIPT = String.raw`import json, sys
from datetime import datetime

def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))

with open(sys.argv[1]) as fh:
    c = json.load(fh)

out = []
add = out.append
add("# Case audit report: " + c["caseId"])
add("")
add("- Trace ID: " + str(c.get("traceId", "n/a")))
add("- Order: %s | %s | $%.2f" % (c["orderId"], c["productSummary"], c["amount"]))
add("- Customer: %s (%s, %s)" % (c["customer"]["name"], c["customer"]["id"], c["customer"]["tier"]))
add("- Issue: " + c["issue"])
decided = (", decided by " + c["decidedBy"]) if c.get("decidedBy") else ""
add("- Outcome: %s via route '%s' (approver: %s%s)" % (c["status"], c["decision"]["route"], c["decision"]["approver"], decided))
add("")

add("## Policy")
add("- Reference: " + c["policy"]["citation"])
for k in c["policy"]["checks"]:
    add("- [%s] %s: %s" % ("x" if k["pass"] else " ", k["label"], k["detail"]))
add("")

add("## Risk")
add("- Level: %s (%s/100)" % (c["risk"]["level"], c["risk"]["score"]))
flags = c["risk"]["flags"] or ["no suspicious pattern detected"]
for f in flags:
    add("- " + f)
add("")

r = c.get("resolution")
if r:
    add("## Proposed resolution")
    add("- %s | $%.2f | %s%% confidence" % (r["action"], r["amount"], r["confidence"]))
    add("- Reason: " + r["reason"])
    add("")

add("## Decision rule")
for line in c["decision"]["rationale"]:
    add("- " + line)
add("")

events = [e for e in c.get("events", []) if e.get("status") != "running"]
if events:
    add("## Timeline")
    t0 = ts(events[0]["ts"])
    for e in events:
        add("- +%.1fs  %s: %s" % ((ts(e["ts"]) - t0).total_seconds(), e["title"], e["summary"]))
    add("")
    add("Total elapsed: %.1fs across %d agent events." % ((ts(events[-1]["ts"]) - t0).total_seconds(), len(events)))
    add("")

calls = c.get("toolCalls", [])
if calls:
    add("## Tool calls")
    add("| Tool | Agent | Scope | Status | ms |")
    add("| --- | --- | --- | --- | --- |")
    for t in calls:
        add("| %s | %s | %s | %s | %s |" % (t["tool"], t["agent"], t["scope"], t["status"], t["ms"]))
    add("")
    add("%d calls, %d denied, %d ms total." % (len(calls), sum(1 for t in calls if t["status"] == "denied"), sum(t["ms"] for t in calls)))

print("\n".join(out))
`;

/** Non-PII summary of a case — this is all the sandbox ever sees. */
function summarize(c: Case) {
  return {
    caseId: c.caseId,
    traceId: c.traceId,
    orderId: c.orderId,
    productSummary: c.productSummary,
    amount: c.amount,
    issue: c.issue,
    status: c.status,
    decidedBy: c.decidedBy,
    customer: { id: c.customer.id, name: c.customer.name, tier: c.customer.tier },
    policy: c.policy,
    risk: c.risk,
    resolution: c.resolution,
    decision: c.decision,
    events: c.events.map(e => ({ agent: e.agent, status: e.status, title: e.title, summary: e.summary, ts: e.ts })),
    toolCalls: c.toolCalls ?? [],
  };
}

/** TypeScript rendering of the same report, used when the sandbox is unavailable. */
function renderLocal(p: ReturnType<typeof summarize>): string {
  const lines = [
    `# Case audit report: ${p.caseId}`,
    "",
    `- Trace ID: ${p.traceId ?? "n/a"}`,
    `- Order: ${p.orderId} | ${p.productSummary} | $${p.amount.toFixed(2)}`,
    `- Customer: ${p.customer.name} (${p.customer.id}, ${p.customer.tier})`,
    `- Issue: ${p.issue}`,
    `- Outcome: ${p.status} via route '${p.decision.route}' (approver: ${p.decision.approver}${p.decidedBy ? `, decided by ${p.decidedBy}` : ""})`,
    "",
    "## Policy",
    `- Reference: ${p.policy.citation}`,
    ...p.policy.checks.map(k => `- [${k.pass ? "x" : " "}] ${k.label}: ${k.detail}`),
    "",
    "## Risk",
    `- Level: ${p.risk.level} (${p.risk.score}/100)`,
    ...(p.risk.flags.length ? p.risk.flags : ["no suspicious pattern detected"]).map(f => `- ${f}`),
    "",
  ];
  if (p.resolution) {
    lines.push("## Proposed resolution", `- ${p.resolution.action} | $${p.resolution.amount.toFixed(2)} | ${p.resolution.confidence}% confidence`, `- Reason: ${p.resolution.reason}`, "");
  }
  lines.push("## Decision rule", ...p.decision.rationale.map(r => `- ${r}`), "");
  const events = p.events.filter(e => e.status !== "running");
  if (events.length) {
    const t0 = new Date(events[0].ts).getTime();
    lines.push("## Timeline", ...events.map(e => `- +${((new Date(e.ts).getTime() - t0) / 1000).toFixed(1)}s  ${e.title}: ${e.summary}`), "");
  }
  if (p.toolCalls.length) {
    lines.push("## Tool calls", "| Tool | Agent | Scope | Status | ms |", "| --- | --- | --- | --- | --- |",
      ...p.toolCalls.map(t => `| ${t.tool} | ${t.agent} | ${t.scope} | ${t.status} | ${t.ms} |`), "");
  }
  return lines.join("\n");
}

export async function buildCaseReport(context: AgentContext, c: Case): Promise<CaseReport> {
  const started = Date.now();
  const payload = summarize(c);
  const filename = `${c.caseId}-audit.md`;
  const make = (engine: CaseReport["engine"], markdown: string): CaseReport => ({
    filename,
    markdown: markdown.slice(0, MAX_REPORT_CHARS),
    engine,
    ms: Date.now() - started,
    at: new Date().toISOString(),
  });

  let sandbox: SandboxLike | undefined;
  try {
    sandbox = (context as unknown as { sandbox?: SandboxLike }).sandbox; // lazily provisioned on first access
  } catch (e) {
    logger.error("Sandbox unavailable:", (e as Error).message);
  }

  if (sandbox) {
    try {
      await sandbox.files.write("/tmp/case.json", JSON.stringify(payload));
      await sandbox.files.write("/tmp/make_report.py", REPORT_SCRIPT);
      const res = await sandbox.commands.run("python3 /tmp/make_report.py /tmp/case.json", { timeout: SANDBOX_TIMEOUT_S });
      const stdout = String(res.stdout ?? "").trim();
      if (res.exitCode === 0 && stdout) return make("sandbox", stdout);
      throw new Error(`exit ${res.exitCode}: ${String(res.stderr ?? "").slice(0, 200)}`);
    } catch (e) {
      logger.error("Sandbox report failed, using local renderer:", (e as Error).message);
    }
  }
  return make("local", renderLocal(payload));
}

/** Archive a report in Blob storage via the reports cloud function. Returns null if unavailable. */
export async function archiveReport(
  context: AgentContext,
  caseId: string,
  report: CaseReport,
): Promise<{ key: string; url: string } | null> {
  const origin = siteOrigin(context);
  if (!origin) return null;
  try {
    const res = await fetch(`${origin}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, filename: report.filename, markdown: report.markdown }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { key?: string; url?: string };
    return data.key && data.url ? { key: data.key, url: data.url } : null;
  } catch (e) {
    logger.error("Report archive failed:", (e as Error).message);
    return null;
  }
}
