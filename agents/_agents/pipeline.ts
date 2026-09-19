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
import { assessRisk, daysSince, detectIssue, evaluatePolicy, findCustomer, issueLabel, money } from "./specialists";
import { caseIdFor, saveCase } from "./store";
import type { Case } from "./types";

type AgentEnv = Record<string, string | undefined>;
type Writer = (e: Record<string, unknown>) => void;

const PACE_MS = 350; // short pause between agent waves so the timeline is readable live

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
  const { customer, known } = findCustomer(order.userId);
  const related = (await listUserOrders(context.store, order.userId)).filter(o => o.orderId !== order.orderId);
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
  emit("policy", "running", "Policy Agent", "Checking return eligibility…");
  emit("risk", "running", "Risk Agent", "Scanning for fraud patterns…");
  const policy = evaluatePolicy(order, issue);
  const risk = assessRisk(customer, order);
  await pace();
  c.policy = policy;
  c.risk = risk;
  emit("policy", policy.eligible ? "done" : "blocked", "Policy Agent",
    policy.eligible ? `Eligible · ${policy.citation}` : `Not eligible · ${policy.checks.filter(k => !k.pass).map(k => k.label).join(", ")}`,
    policy.checks.map(k => `${k.pass ? "✓" : "✗"} ${k.label} — ${k.detail}`));
  emit("risk", risk.level === "LOW" ? "done" : risk.level === "MEDIUM" ? "warn" : "blocked", "Risk Agent",
    `Risk ${risk.level} (${risk.score}/100)`,
    risk.flags.length ? risk.flags : ["No suspicious pattern detected"]);
  await pace();

  // ── Resolution (LLM) ──
  c.resolution = null;
  if (policy.eligible) {
    emit("resolution", "running", "Resolution Agent", "Weighing refund, replacement or store credit…");
    const { resolution, source } = await resolutionAgent({ order, customer, issue, policy, risk, userMessage }, env, signal);
    c.resolution = resolution;
    const label = resolution.action === "replace" ? "Replace item" : resolution.action === "refund" ? "Refund" : "Store credit";
    emit("resolution", "done", "Resolution Agent", `${label} · ${money(resolution.amount)} · ${resolution.confidence}% confidence`,
      [resolution.reason, source === "llm" ? "Reasoned by model" : "Rule-based fallback (model unavailable)"]);
  } else {
    emit("resolution", "blocked", "Resolution Agent", "No resolution proposed — request isn't eligible under policy");
  }
  await pace();

  // ── Decision engine + approval layer (deterministic) ──
  const decision = decide(order.totalAmount, policy, risk);
  c.decision = decision;
  const approverLabel = decision.approver === "manager" ? "manager" : "support-agent";

  if (decision.route === "denied") {
    emit("approval", "blocked", "Approval Layer", "Denied by policy — no approval path", decision.rationale);
    await closeCase(context, env, c, order, emit, "denied");
    return {
      currentOrder: order,
      aiResponse: `I'm sorry — I can't process this request for **${order.orderId}**.\n\n${policy.checks.filter(k => !k.pass).map(k => `- ${k.label}: ${k.detail}`).join("\n")}\n\n*Reference: ${policy.citation}.*`,
      cardEvent: { type: "case", data: { case: c } },
      waitingForUser: false,
    };
  }

  if (decision.route === "autonomous") {
    emit("approval", "done", "Approval Layer", "Auto-approved — within the agent's autonomy limit", decision.rationale);
    await pace();
    const updated = await executeCase(context, env, c, order, emit);
    return {
      currentOrder: updated,
      aiResponse: `${c.comms?.chat ?? "Your request has been processed."}\n\n*Handled autonomously — ${decision.rationale[0]}.*`,
      cardEvent: { type: "case", data: { case: c } },
      waitingForUser: false,
    };
  }

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
