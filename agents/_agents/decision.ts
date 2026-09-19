/**
 * Decision engine — deterministic. The LLM proposes; this decides who has to sign off.
 * Thresholds live in code so no prompt (or prompt injection) can move them.
 */
import type { Decision, PolicyResult, RiskResult } from "./types";
import { money } from "./specialists";

export const AUTONOMOUS_BELOW = 50;
export const SUPPORT_APPROVAL_UP_TO = 250;

export function decide(exposure: number, policy: PolicyResult, risk: RiskResult): Decision {
  if (!policy.eligible) {
    const failed = policy.checks.filter(c => !c.pass).map(c => `${c.label}: ${c.detail}`);
    return { route: "denied", approver: "none", rationale: ["Failed policy checks — no approval path", ...failed] };
  }
  if (risk.level === "HIGH") {
    return {
      route: "blocked",
      approver: "manager",
      rationale: [`High fraud risk (${risk.score}/100) — automatic handling disabled`, ...risk.flags],
    };
  }
  if (exposure > SUPPORT_APPROVAL_UP_TO) {
    return { route: "manager", approver: "manager", rationale: [`${money(exposure)} exceeds ${money(SUPPORT_APPROVAL_UP_TO)} — manager approval required`] };
  }
  if (exposure >= AUTONOMOUS_BELOW) {
    return { route: "human", approver: "support", rationale: [`${money(exposure)} is between ${money(AUTONOMOUS_BELOW)} and ${money(SUPPORT_APPROVAL_UP_TO)} — human approval required`] };
  }
  if (risk.level === "MEDIUM") {
    return { route: "human", approver: "support", rationale: [`Under ${money(AUTONOMOUS_BELOW)}, but medium risk (${risk.score}/100) — human approval required`] };
  }
  return { route: "autonomous", approver: "none", rationale: [`${money(exposure)} is under ${money(AUTONOMOUS_BELOW)} and risk is LOW — agent may act autonomously`] };
}
