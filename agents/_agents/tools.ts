/**
 * Tool registry — the assistant's capability boundary.
 *
 * Every capability an agent uses goes through `runTool`, which
 *   1. enforces deny-by-default grants: an agent may only call the tools listed for it in GRANTS,
 *   2. requires an approval proof for irreversible tools (money movement can't run without one),
 *   3. records each call (tool, agent, scope, outcome, duration) on the case for end-to-end tracing.
 *
 * The model-backed agents are tools too, but only with the "model" scope: a model can propose
 * (resolution.propose) or draft (comms.draft); it can never call refund.execute.
 */
import type { AgentName, Case, ToolCall, ToolScope } from "./types";

interface ToolSpec {
  description: string;
  scope: ToolScope;
  requiresApproval?: boolean;
}

export const TOOLS = {
  "customer.lookup": { description: "Read a customer profile from the CRM", scope: "read" },
  "order.history": { description: "List the customer's other orders from the order store (KV)", scope: "read" },
  "policy.evaluate": { description: "Evaluate return eligibility (Python/FastAPI service, TypeScript fallback)", scope: "read" },
  "risk.assess": { description: "Score fraud risk (Python/FastAPI service, TypeScript fallback)", scope: "read" },
  "resolution.propose": { description: "Ask the model to propose a resolution — a proposal only, it cannot execute", scope: "model" },
  "refund.execute": {
    description: "Execute a refund / replacement / store credit via the (mock) payment, shipping and CRM APIs",
    scope: "irreversible",
    requiresApproval: true,
  },
  "comms.draft": { description: "Draft customer messages (chat, email, SMS)", scope: "model" },
  "sandbox.report": { description: "Build an audit report by running code in an isolated sandbox", scope: "sandbox" },
} as const satisfies Record<string, ToolSpec>;

export type ToolName = keyof typeof TOOLS;

/** Deny-by-default: an agent may only call the tools listed here. */
export const GRANTS: Record<AgentName, readonly ToolName[]> = {
  orchestrator: [],
  customer: ["customer.lookup"],
  order: ["order.history"],
  policy: ["policy.evaluate"],
  risk: ["risk.assess"],
  resolution: ["resolution.propose"],
  approval: [],
  action: ["refund.execute"],
  communication: ["comms.draft"],
  audit: ["sandbox.report"],
};

/** Proof that an irreversible action was authorised: by the autonomy policy or by a human role. */
export interface ApprovalProof {
  by: "autonomy-policy" | "support" | "manager";
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

export const newTraceId = () => `trc_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-4)}`;

export async function runTool<T>(
  c: Case,
  agent: AgentName,
  tool: ToolName,
  fn: () => Promise<T> | T,
  opts: { approval?: ApprovalProof; note?: string } = {},
): Promise<T> {
  const spec: ToolSpec = TOOLS[tool];
  const record = (status: ToolCall["status"], ms: number, note?: string) => {
    (c.toolCalls ??= []).push({
      tool,
      agent,
      scope: spec.scope,
      status,
      ms,
      ts: new Date().toISOString(),
      ...(note ? { note } : {}),
    });
  };

  if (!GRANTS[agent].includes(tool)) {
    record("denied", 0, `agent "${agent}" is not granted "${tool}"`);
    throw new PermissionError(`Agent "${agent}" is not permitted to use tool "${tool}"`);
  }
  if (spec.requiresApproval && !opts.approval) {
    record("denied", 0, "irreversible tool called without an approval proof");
    throw new PermissionError(`Tool "${tool}" requires an approval proof`);
  }

  const started = Date.now();
  try {
    const value = await fn();
    record("ok", Date.now() - started, opts.approval ? `authorised by ${opts.approval.by}` : opts.note);
    return value;
  } catch (e) {
    record("error", Date.now() - started, (e as Error).message.slice(0, 120));
    throw e;
  }
}
