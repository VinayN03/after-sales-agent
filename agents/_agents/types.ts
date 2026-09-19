/**
 * Types for the after-sales multi-agent pipeline.
 *
 * Specialist agents (customer, order, policy, risk) are deterministic; the LLM is used only for
 * resolution and customer communication. Approval, action and audit are platform services.
 */

export type AgentName =
  | "orchestrator" | "customer" | "order" | "policy" | "risk"
  | "resolution" | "approval" | "action" | "communication" | "audit";

export type EventStatus = "running" | "done" | "warn" | "blocked";

export interface AgentEvent {
  agent: AgentName;
  status: EventStatus;
  title: string;
  summary: string;
  details?: string[];
  ts: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: "Standard" | "Silver" | "Gold" | "Platinum";
  memberSinceDays: number;
  lifetimeOrders: number;
  pastCases: Array<{ date: string; topic: string }>;
  refunds90d: number;
  damageClaims90d: number;
  replacements90d: number;
  addressMismatch: boolean;
  preferredChannel: "email" | "sms" | "chat";
  payment: string;
}

export type Issue = "damaged" | "wrong_item" | "changed_mind";
export type ResolutionAction = "refund" | "replace" | "store_credit";

export interface PolicyCheck { label: string; pass: boolean; detail: string }
export interface PolicyResult {
  eligible: boolean;
  checks: PolicyCheck[];
  citation: string;
  allowedActions: ResolutionAction[];
}

export interface RiskResult {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH";
  flags: string[];
}

export interface Resolution {
  action: ResolutionAction;
  amount: number;
  reason: string;
  confidence: number;
}

export type Route = "autonomous" | "human" | "manager" | "blocked" | "denied";
export interface Decision {
  route: Route;
  approver: "none" | "support" | "manager";
  rationale: string[];
}

export interface Comms {
  chat: string;
  emailSubject: string;
  emailBody: string;
  sms: string;
}

export type CaseStatus = "pending_approval" | "executed" | "rejected" | "denied";

export interface Case {
  caseId: string;
  orderId: string;
  customer: Customer;
  productSummary: string;
  amount: number;
  issue: Issue;
  userMessage: string;
  policy: PolicyResult;
  risk: RiskResult;
  resolution: Resolution | null;
  decision: Decision;
  status: CaseStatus;
  events: AgentEvent[];
  execution?: string[];
  comms?: Comms;
  decidedBy?: string;
  createdAt: string;
  updatedAt: string;
}
