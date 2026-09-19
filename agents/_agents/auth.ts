/**
 * Operator authentication for the human-in-the-loop gate.
 *
 * In production the approver role (support / manager) would come from an authenticated SSO session
 * (e.g. an identity-provider claim), never from a value the browser sends. For this hackathon the
 * server verifies a shared operator passcode instead: it is the stand-in for that session, and it
 * makes the permission boundary server-enforced rather than a UI convention.
 *
 * Passcodes come from the SUPPORT_PASSCODE / MANAGER_PASSCODE environment variables and fall back
 * to the public demo defaults below, so the demo works out of the box.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const DEMO_PASSCODES = { support: "support-demo", manager: "manager-demo" } as const;

export type OperatorRole = "support" | "manager";

/** Constant-time string comparison: hash both sides so lengths match, then timingSafeEqual. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Verify that `passcode` proves the claimed `role`.
 * - "support" accepts the support passcode OR the manager passcode (a manager can act as support).
 * - "manager" accepts only the manager passcode.
 */
export function verifyOperator(
  env: Record<string, string | undefined>,
  role: OperatorRole,
  passcode: unknown,
): boolean {
  if (typeof passcode !== "string") return false;
  const supportCode = env.SUPPORT_PASSCODE || DEMO_PASSCODES.support;
  const managerCode = env.MANAGER_PASSCODE || DEMO_PASSCODES.manager;

  // Evaluate both comparisons (no short-circuit) so timing does not leak which one matched.
  const isManager = safeEqual(passcode, managerCode);
  if (role === "manager") return isManager;
  const isSupport = safeEqual(passcode, supportCode);
  return isSupport || isManager;
}

/** Manager-only operations (e.g. resetting demo data). */
export function verifyManager(env: Record<string, string | undefined>, passcode: unknown): boolean {
  return verifyOperator(env, "manager", passcode);
}
