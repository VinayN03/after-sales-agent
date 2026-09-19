import type { AgentContext } from '@edgeone/types';
/**
 * Orchestrator: runs the after-sales specialist agents for a refund request and streams each
 * agent's activity to the UI (custom "agent_event" stream events).
 *
 *   Orchestrator → [Customer ‖ Order] → [Policy ‖ Risk] → Resolution (LLM)
 *     → Decision engine (deterministic) → autonomous | human approval | manager approval | denied
 *     → Execution → Communication (LLM) → Audit
 */
import { saveOrder, type Order } from "../_shared";
import { listUserOrders } from "../_data/orders";
import { decide } from "./decision";
import { closeCase, executeCase, makeEmitter } from "./execution";
import { resolutionAgent } from "./resolution";
import { callPython } from "./python-service";
import { newTraceId, runTool } from "./tools";
import { assessRisk, daysSince, detectIssue, evaluatePolicy, findCustomer, issueLabel, money } from "./specialists";
import { caseIdFor, saveCase } from "./store";
import type { Case, PolicyResult, RiskResult } from "./types";

type AgentEnv = Record<string, string | undefined>;
type Writer = (e: Record<string, unknown>) => void;

const PACE_MS = 350; // short pause between agent waves so the timeline is readable live
const AUTONOMY_GRACE_MS = 2000; // window to press Stop before an autonomous action executes

/**
 * Interruption guard. Called before every side effect (saving a case, executing a refund) so a
 * user pressing Stop — or dropping the connection — guarantees nothing is executed or recorded
 * afterwards. Once execution has *started* it runs to completion, so an order is never left half-processed.
 */
function checkpoint(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Run interrupted by the user", "AbortError");
}

export async function runRefundPipeline(args: {
  order: Order;
  userMessage: string;
  context: AgentContext;
  env: AgentEnv;
  writer?: Writer;
  signal?: AbortSignal;
}) {
  const { order, userMessage, context, env, writer, signal } = args;
  const pace = () => (writer ? new Promise(r => setTimeout(r, PACE_MS)) : Promise.resolve());

  const issue = detectIssue(userMessage);
  const c = {
    caseId: caseIdFor(order.orderId),
    traceId: newTraceId(),
    toolCalls: [],
    orderId: order.orderId,
    productSummary: order.items.map(i => i.name).join(", "),
    amount: order.totalAmount,
    issue,
    userMessage: userMessage.slice(0, 500),
    events: [],
    status: "pending_approval",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as Case;
  const emit = makeEmitter(c, writer);

  // ── Orchestrator ──
  emit("orchestrator", "running", "Orchestrator", "Refund request detected — planning delegation…");
  await pace();
  emit("orchestrator", "done", "Orchestrator", `Refund request for ${order.orderId} · ${issueLabel(issue)}`, [
    "Delegating to Customer, Order, Policy and Risk agents",
    "Approval, execution and audit run as deterministic platform services",
  ]);

  // ── Wave 1: Customer ‖ Order ──
  emit("customer", "running", "Customer Agent", "Identifying the customer…");
  emit("order", "running", "Order Agent", "Retrieving order, payment and shipping data…");
  const { customer, known } = await runTool(c, "customer", "customer.lookup", () => findCustomer(order.userId));
  const related = (await runTool(c, "order", "order.history", () => listUserOrders(context.store, order.userId)))
    .filter(o => o.orderId !== order.orderId);
  await pace();
  c.customer = customer;
  emit("customer", "done", "Customer Agent",
    known ? `${customer.name} · ${customer.tier} · ${customer.id}` : "Guest customer (no CRM profile)",
    [
      `${customer.email} · ${customer.phone}`,
      `${customer.lifetimeOrders} lifetime orders · member ${Math.round(customer.memberSinceDays / 30)} months`,
      ...customer.pastCases.map(p => `Past case — ${p.date}: ${p.topic}`),
      `Prefers ${customer.preferredChannel}`,
    ]);
  const deliveredAge = daysSince(order.deliveredAt ?? order.updatedAt);
  emit("order", "done", "Order Agent",
    `${c.productSummary} · ${money(order.totalAmount)} · ${order.status}${order.status === "delivered" ? ` ${deliveredAge}d ago` : ""}`,
    [
      `Payment: ${order.payment ?? customer.payment}`,
      order.trackingNumber ? `Tracking: ${order.carrier ?? ""} ${order.trackingNumber}`.trim() : "No tracking number",
      `${related.length} other order${related.length === 1 ? "" : "s"} on this account`,
    ]);

  // ── Wave 2: Policy ‖ Risk ──
  checkpoint(signal);
  emit("policy", "running", "Policy Agent", "Checking return eligibility…");
  emit("risk", "running", "Risk Agent", "Scanning for fraud patterns…");
  // Both run in the Python/FastAPI service in parallel; each falls back to the TypeScript rules if
  // the service is unreachable or returns something unexpected.
  const [policy, risk] = await Promise.all([
    runTool(c, "policy", "policy.evaluate", async (): Promise<PolicyResult> => {
    const py = await callPython<PolicyResult>(context, env, "/policy", {
      order_status: order.status,
      delivered_days: deliveredAge,
      item_text: order.items.map(i => `${i.name} ${i.specs}`).join(" "),
      issue,
    }, signal);
    return py && typeof py.eligible === "boolean" && Array.isArray(py.checks) ? py : evaluatePolicy(order, issue);
    }),
    runTool(c, "risk", "risk.assess", async (): Promise<RiskResult> => {
    const py = await callPython<RiskResult>(context, env, "/risk", {
      refunds_90d: customer.refunds90d,
      damage_claims_90d: customer.damageClaims90d,
      replacements_90d: customer.replacements90d,
      address_mismatch: customer.addressMismatch,
      member_since_days: customer.memberSinceDays,
      order_total: order.totalAmount,
    }, signal);
    return py && typeof py.score === "number" && Array.isArray(py.flags) ? py : assessRisk(customer, order);
    }),
  ]);
  const engineLine = (e?: string) => `Engine: ${e === "python" ? "Python · FastAPI service" : "TypeScript rules (fallback)"}`;
  await pace();
  c.policy = policy;
  c.risk = risk;
  emit("policy", policy.eligible ? "done" : "blocked", "Policy Agent",
    policy.eligible ? `Eligible · ${policy.citation}` : `Not eligible · ${policy.checks.filter(k => !k.pass).map(k => k.label).join(", ")}`,
    [engineLine(policy.engine), ...policy.checks.map(k => `${k.pass ? "✓" : "✗"} ${k.label} — ${k.detail}`)]);
  emit("risk", risk.level === "LOW" ? "done" : risk.level === "MEDIUM" ? "warn" : "blocked", "Risk Agent",
    `Risk ${risk.level} (${risk.score}/100)`,
    [engineLine(risk.engine), ...(risk.flags.length ? risk.flags : ["No suspicious pattern detected"])]);
  await pace();

  // ── Resolution (LLM) ──
  checkpoint(signal); // don't spend a model call on a run the user has already stopped
  c.resolution = null;
  if (policy.eligible) {
    emit("resolution", "running", "Resolution Agent", "Weighing refund, replacement or store credit…");
    const { resolution, source } = await runTool(c, "resolution", "resolution.propose",
      () => resolutionAgent({ order, customer, issue, policy, risk, userMessage }, env, signal));
    c.resolution = resolution;
    const label = resolution.action === "replace" ? "Replace item" : resolution.action === "refund" ? "Refund" : "Store credit";
    emit("resolution", "done", "Resolution Agent", `${label} · ${money(resolution.amount)} · ${resolution.confidence}% confidence`,
      [resolution.reason, source === "llm" ? "Reasoned by model" : "Rule-based fallback (model unavailable)"]);
  } else {
    emit("resolution", "blocked", "Resolution Agent", "No resolution proposed — request isn't eligible under policy");
  }
  await pace();

  // ── Decision engine + approval layer (deterministic) ──
  checkpoint(signal);
  const decision = decide(order.totalAmount, policy, risk);
  c.decision = decision;
  const approverLabel = decision.approver === "manager" ? "manager" : "support-agent";

  if (decision.route === "denied") {
    emit("approval", "blocked", "Approval Layer", "Denied by policy — no approval path", decision.rationale);
    checkpoint(signal);
    await closeCase(context, env, c, order, emit, "denied");
    return {
      currentOrder: order,
      aiResponse: `I'm sorry — I can't process this request for **${order.orderId}**.\n\n${policy.checks.filter(k => !k.pass).map(k => `- ${k.label}: ${k.detail}`).join("\n")}\n\n*Reference: ${policy.citation}.*`,
      cardEvent: { type: "case", data: { case: c } },
      waitingForUser: false,
    };
  }

  if (decision.route === "autonomous") {
    // Grace window: the operator sees "executing in 2s" and can press Stop before any money moves.
    emit("approval", "warn", "Approval Layer", `Auto-approved — executing in ${AUTONOMY_GRACE_MS / 1000}s. Press Stop to cancel.`, decision.rationale);
    if (writer) await new Promise(r => setTimeout(r, AUTONOMY_GRACE_MS));
    checkpoint(signal); // last chance to stop before money moves
    emit("approval", "done", "Approval Layer", "Auto-approved — within the agent's autonomy limit", decision.rationale);
    const updated = await executeCase(context, env, c, order, emit);
    return {
      currentOrder: updated,
      aiResponse: `${c.comms?.chat ?? "Your request has been processed."}\n\n*Handled autonomously — ${decision.rationale[0]}.*`,
      cardEvent: { type: "case", data: { case: c } },
      waitingForUser: false,
    };
  }

  checkpoint(signal); // don't queue a case for approval if the user stopped the run
  emit("approval", "warn", "Approval Layer",
    decision.route === "blocked"
      ? "Escalated to manager — automatic handling disabled"
      : `Waiting for ${approverLabel} approval`,
    decision.rationale);
  const pending: Order = {
    ...order,
    status: "refund_requested",
    refundReason: userMessage.slice(0, 200),
    refundAmount: c.resolution!.amount,
    updatedAt: new Date().toISOString(),
  };
  await saveOrder(context, pending);
  c.status = "pending_approval";
  await saveCase(context, c);

  const r = c.resolution!;
  const label = r.action === "replace" ? "a replacement" : r.action === "refund" ? `a refund of ${money(r.amount)}` : `store credit of ${money(r.amount)}`;
  return {
    currentOrder: pending,
    aiResponse: `Thanks — I've reviewed **${order.orderId}** with our specialist agents and recommend **${label}**.\n\n*${r.reason}*\n\nThis needs **${decision.approver === "manager" ? "manager" : "human"} approval** before anything is executed, so I've sent it to the review queue. You'll get a confirmation as soon as it's decided.`,
    cardEvent: { type: "case", data: { case: c } },
    waitingForUser: false,
  };
}
