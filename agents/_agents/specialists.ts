/**
 * Deterministic specialist agents: customer, order, policy, risk.
 * Rules, not LLM calls — fast, free, and impossible to talk out of a decision.
 */
import type { Order } from "../_shared";
import { CUSTOMERS } from "./data";
import type { Customer, Issue, PolicyResult, ResolutionAction, RiskResult } from "./types";

const DAY = 86_400_000;
export const RETURN_WINDOW_DAYS = 30;

export const daysSince = (iso?: string) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY)) : 0);
export const money = (n: number) => `$${n.toFixed(2)}`;

// ─── Orchestrator helper: classify what went wrong (keyword rules, no LLM) ───

export function detectIssue(message: string): Issue {
  const m = message.toLowerCase();
  if (/damag|broken|broke|crack|defect|faulty|not working|doesn'?t work|stopped working|dead on|shatter|scratch|损坏|坏了|破损|故障/.test(m)) return "damaged";
  if (/wrong item|wrong product|incorrect item|different item|not what i ordered|发错/.test(m)) return "wrong_item";
  return "changed_mind";
}

export const issueLabel = (i: Issue) =>
  i === "damaged" ? "Damaged / defective item" : i === "wrong_item" ? "Wrong item received" : "No defect reported";

// ─── Customer agent ───

export function findCustomer(userId: string): { customer: Customer; known: boolean } {
  const known = CUSTOMERS[userId];
  if (known) return { customer: known, known: true };
  return {
    known: false,
    customer: {
      id: userId, name: "Guest customer", email: "guest@example.com", phone: "—", tier: "Standard",
      memberSinceDays: 365, lifetimeOrders: 1, pastCases: [], refunds90d: 0, damageClaims90d: 0,
      replacements90d: 0, addressMismatch: false, preferredChannel: "chat", payment: "Card on file",
    },
  };
}

// ─── Policy & eligibility agent ───

export function evaluatePolicy(order: Order, issue: Issue): PolicyResult {
  const delivered = order.status === "delivered";
  const age = daysSince(order.deliveredAt ?? order.updatedAt);
  const finalSale = order.items.some(i => /clearance|final sale/i.test(`${i.name} ${i.specs}`));
  const alreadyRefunded = /^(refund|exchange)_/.test(order.status);

  const checks = [
    { label: "Order delivered", pass: delivered || order.status === "shipped", detail: `Status: ${order.status}` },
    {
      label: `Within ${RETURN_WINDOW_DAYS}-day return window`,
      pass: !delivered || age <= RETURN_WINDOW_DAYS,
      detail: delivered ? `Delivered ${age} day${age === 1 ? "" : "s"} ago` : "Not yet delivered",
    },
    { label: "Product eligible", pass: !finalSale, detail: finalSale ? "Final-sale item" : "Standard returnable item" },
    { label: "No previous refund on this order", pass: !alreadyRefunded, detail: alreadyRefunded ? "Refund already on record" : "No prior refund" },
  ];

  const allowedActions: ResolutionAction[] =
    issue === "changed_mind" ? ["refund", "store_credit"] : ["replace", "refund", "store_credit"];
  return {
    eligible: checks.every(c => c.pass),
    checks,
    citation: issue === "changed_mind" ? "Standard Return Policy v3.2" : "Damaged Item Policy v3.2",
    allowedActions,
    engine: "typescript",
  };
}

// ─── Fraud / risk agent ───

export function assessRisk(customer: Customer, order: Order): RiskResult {
  let score = 0;
  const flags: string[] = [];
  const add = (points: number, flag: string) => { score += points; flags.push(flag); };

  if (customer.refunds90d >= 3) add(35, `${customer.refunds90d} refunds in the last 90 days`);
  if (customer.damageClaims90d >= 3) add(25, `${customer.damageClaims90d} damage claims in the last 90 days`);
  if (customer.replacements90d >= 2) add(10, `${customer.replacements90d} replacement requests in the last 90 days`);
  if (customer.addressMismatch) add(20, "Shipping address differs from billing address");
  if (customer.memberSinceDays < 30) add(10, `New account (${customer.memberSinceDays} days old)`);
  if (order.totalAmount > 250) add(10, `High-value order (${money(order.totalAmount)})`);

  return { score, level: score >= 60 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW", flags, engine: "typescript" };
}
