import type { AgentName, Case } from "../../../agents/_agents/types";

const CONVERSATION_KEY = "after-sales-conversation-id"; // same key the chat panel uses

export function getConversationId(): string {
  try {
    let id = localStorage.getItem(CONVERSATION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CONVERSATION_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

export const initials = (name: string) =>
  name.split(" ").map(p => p[0] ?? "").slice(0, 2).join("").toUpperCase();

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
export const money = (n: number) => `$${n.toFixed(2)}`;
export const shortOrder = (orderId: string) => `#${orderId.split("-").pop()}`;

export function caseStatus(c: Case): { label: string; cls: string } {
  if (c.status === "pending_approval") {
    return c.decision.route === "blocked"
      ? { label: "Escalated", cls: "bg-red-50 text-red-600" }
      : { label: "Waiting Approval", cls: "bg-amber-50 text-amber-700" };
  }
  if (c.status === "executed") return { label: "Resolved", cls: "bg-emerald-50 text-emerald-700" };
  if (c.status === "rejected") return { label: "Rejected", cls: "bg-rose-50 text-rose-600" };
  return { label: "Denied", cls: "bg-slate-100 text-slate-600" };
}

/** Friendly headline for each agent's activity row. */
export const ACTIVITY_HEADING: Record<AgentName, string> = {
  orchestrator: "Request received",
  customer: "Customer identified",
  order: "Order retrieved",
  policy: "Policy checked",
  risk: "Risk assessment",
  resolution: "Resolution proposed",
  approval: "Approval",
  action: "Action executed",
  communication: "Customer notified",
  audit: "Audit recorded",
};

export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
