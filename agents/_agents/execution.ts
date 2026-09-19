import type { AgentContext } from '@edgeone/types';
/**
 * Platform services that run after a decision: action execution (mock APIs), customer
 * communication (second LLM-backed agent) and audit. Shared by the chat pipeline (autonomous
 * path) and /approve-refund (human-approved path).
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createModel, createLogger, saveOrder, type Order } from "../_shared";
import { saveCase } from "./store";
import { CREDIT_BONUS } from "./resolution";
import { runTool, type ApprovalProof } from "./tools";
import { money } from "./specialists";
import type { AgentEvent, AgentName, Case, Comms, EventStatus } from "./types";

const logger = createLogger("execution");
const COMMS_TIMEOUT_MS = 6000;
type AgentEnv = Record<string, string | undefined>;
type Writer = (e: Record<string, unknown>) => void;

export type Emit = (agent: AgentName, status: EventStatus, title: string, summary: string, details?: string[]) => AgentEvent;

/** Records every event on the case (the audit trail) and streams it to the UI when a writer is given. */
export function makeEmitter(c: Case, writer?: Writer): Emit {
  return (agent, status, title, summary, details) => {
    const event: AgentEvent = { agent, status, title, summary, ts: new Date().toISOString(), ...(details ? { details } : {}) };
    c.events.push(event);
    writer?.({ type: "agent_event", event });
    return event;
  };
}

const rid = (prefix: string, n = 4) => `${prefix}${Math.floor(Math.random() * 10 ** n).toString().padStart(n, "0")}`;
const firstName = (c: Case) => c.customer.name.split(" ")[0];

// ─── Action / execution agent (mock APIs) ───

function runAction(c: Case, order: Order): { steps: string[]; order: Order } {
  const r = c.resolution!;
  const now = new Date().toISOString();
  const crm = rid("CRM-");

  if (r.action === "replace") {
    const newId = rid("ORD-R-");
    return {
      steps: [
        `Replacement order ${newId} created`,
        `Shipping label ${rid("1Z", 6)} generated`,
        `Return label for ${order.orderId} emailed to ${c.customer.email}`,
        `Order ${order.orderId} status → Exchange Shipped`,
        `CRM ${crm} updated`,
      ],
      order: { ...order, status: "exchange_shipped", exchangeNewItem: order.items[0]?.name, exchangeReason: c.userMessage.slice(0, 200), updatedAt: now },
    };
  }
  const isCredit = r.action === "store_credit";
  return {
    steps: [
      isCredit
        ? `Store credit of ${money(r.amount)} (includes ${Math.round(CREDIT_BONUS * 100)}% bonus) issued to ${c.customer.id}`
        : `Refund of ${money(r.amount)} initiated to ${c.customer.payment}`,
      `Transaction ${rid("TXN-", 6)} submitted (mock payment API)`,
      `Order ${order.orderId} status → Refund Approved`,
      `CRM ${crm} updated`,
    ],
    order: { ...order, status: "refund_approved", refundReason: c.userMessage.slice(0, 200), refundAmount: r.amount, updatedAt: now },
  };
}

// ─── Communication agent ───

const RESOLUTION_LABEL = { refund: "refund", replace: "replacement", store_credit: "store credit" } as const;

function templateComms(c: Case, outcome: "approved" | "rejected" | "denied"): Comms {
  const name = firstName(c);
  if (outcome === "approved") {
    const label = RESOLUTION_LABEL[c.resolution!.action];
    const line = c.execution?.[0] ?? `Your ${label} has been processed`;
    return {
      chat: `Hi ${name}! Your ${label} for order ${c.orderId} is approved. ${line}.`,
      emailSubject: `Your ${label} for order ${c.orderId}`,
      emailBody: `Hi ${name},\n\nGood news — we've approved your ${label} for order ${c.orderId}. ${line}.\n\nThanks for your patience,\nSupport Team`,
      sms: `Hi ${name}, your ${label} for ${c.orderId} is approved. ${line}.`.slice(0, 160),
    };
  }
  const why = outcome === "denied"
    ? c.policy.checks.filter(k => !k.pass).map(k => k.detail).join("; ") || "it doesn't meet our return policy"
    : "our team wasn't able to approve it";
  return {
    chat: `Hi ${name}, we're sorry — we can't process this request for order ${c.orderId}: ${why}.`,
    emailSubject: `Update on your request for order ${c.orderId}`,
    emailBody: `Hi ${name},\n\nThank you for contacting us about order ${c.orderId}. Unfortunately we can't process this request: ${why}.\n\nIf you'd like to talk it through, just reply to this email.\n\nSupport Team`,
    sms: `Hi ${name}, we can't process your request for ${c.orderId}: ${why}.`.slice(0, 160),
  };
}

export async function communicationAgent(c: Case, outcome: "approved" | "rejected" | "denied", env: AgentEnv): Promise<{ comms: Comms; source: "llm" | "template" }> {
  const template = templateComms(c, outcome);
  if (outcome !== "approved" || !env.AI_GATEWAY_API_KEY || !env.AI_GATEWAY_BASE_URL) return { comms: template, source: "template" };
  try {
    const response = await createModel(env).invoke([
      new SystemMessage(
        `You are the Communication Agent for an online store. Write the confirmation to the customer.
Return ONLY JSON: {"chat":"max 2 sentences","emailSubject":"...","emailBody":"3-4 short sentences, sign off 'Support Team'","sms":"max 160 characters"}
Be warm and concise. Use only the facts provided — do not invent amounts, dates or IDs.`,
      ),
      new HumanMessage(JSON.stringify({
        customerFirstName: firstName(c),
        orderId: c.orderId,
        resolution: RESOLUTION_LABEL[c.resolution!.action],
        amount: money(c.resolution!.amount),
        whatWasDone: c.execution,
        tier: c.customer.tier,
      })),
    ], { signal: AbortSignal.timeout(COMMS_TIMEOUT_MS) }); // slow model → fall back to the template
    const text = typeof response.content === "string" ? response.content : "";
    const p = JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
    if (!p.chat || !p.emailBody || !p.sms) throw new Error("incomplete comms JSON");
    return {
      source: "llm",
      comms: {
        chat: String(p.chat), emailSubject: String(p.emailSubject || template.emailSubject),
        emailBody: String(p.emailBody), sms: String(p.sms).slice(0, 160),
      },
    };
  } catch (e) {
    logger.error("Communication LLM failed, using template:", (e as Error).message);
    return { comms: template, source: "template" };
  }
}

// ─── Audit ───

export function decisionTrace(c: Case): string[] {
  return [
    ...c.policy.checks.map(k => `${k.pass ? "✓" : "✗"} ${k.label} — ${k.detail}`),
    `${c.risk.level === "LOW" ? "✓" : "⚠"} Fraud risk ${c.risk.level} (${c.risk.score}/100)`,
    ...(c.resolution ? [`Proposed: ${RESOLUTION_LABEL[c.resolution.action]} · ${c.resolution.confidence}% confidence`] : []),
    ...c.decision.rationale.map(r => `Decision rule: ${r}`),
    `Policy reference: ${c.policy.citation}`,
  ];
}

function emitAudit(c: Case, emit: Emit) {
  const count = c.events.filter(e => e.status !== "running").length + 1;
  emit("audit", "done", "Audit Agent", `${count} events recorded · ${c.policy.citation}`, decisionTrace(c));
}

// ─── Finalizers ───

/** Who authorised execution: the human role that decided the case, or the autonomy policy. */
function approvalFor(c: Case): ApprovalProof | undefined {
  if (c.decidedBy === "support" || c.decidedBy === "manager") return { by: c.decidedBy };
  if (c.decision?.route === "autonomous") return { by: "autonomy-policy" };
  return undefined;
}

/** Run the action + communication + audit steps for an approved (or autonomous) case. */
export async function executeCase(context: AgentContext, env: AgentEnv, c: Case, order: Order, emit: Emit): Promise<Order> {
  emit("action", "running", "Execution Agent", "Calling refund / order / shipping / CRM APIs…");
  // Irreversible tool: the registry refuses to run it without proof of authorisation — either the
  // autonomy policy (the decision engine routed this case as autonomous) or a human role that decided it.
  const { steps, updated } = await runTool(c, "action", "refund.execute", async () => {
    const r = runAction(c, order);
    await saveOrder(context, r.order);
    return { steps: r.steps, updated: r.order };
  }, { approval: approvalFor(c) });
  c.execution = steps;
  emit("action", "done", "Execution Agent", steps[0], steps);

  emit("communication", "running", "Communication Agent", "Drafting customer messages…");
  const { comms, source } = await runTool(c, "communication", "comms.draft", () => communicationAgent(c, "approved", env));
  c.comms = comms;
  emit("communication", "done", "Communication Agent",
    `Drafted chat, email and SMS · customer prefers ${c.customer.preferredChannel}${source === "llm" ? "" : " (template)"}`);

  c.status = "executed";
  emitAudit(c, emit);
  await saveCase(context, c);
  return updated;
}

/** Close a case without executing: rejected by a human, or denied by policy. */
export async function closeCase(context: AgentContext, env: AgentEnv, c: Case, order: Order, emit: Emit, outcome: "rejected" | "denied"): Promise<Order> {
  emit("communication", "running", "Communication Agent", "Drafting customer notice…");
  const { comms } = await runTool(c, "communication", "comms.draft", () => communicationAgent(c, outcome, env));
  c.comms = comms;
  emit("communication", "done", "Communication Agent", "Drafted decline notice (chat, email, SMS)");

  c.status = outcome;
  const updated: Order = outcome === "rejected"
    ? { ...order, status: "refund_rejected", updatedAt: new Date().toISOString() }
    : order;
  if (outcome === "rejected") await saveOrder(context, updated);
  emitAudit(c, emit);
  await saveCase(context, c);
  return updated;
}
