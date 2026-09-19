import type { AgentContext } from '@edgeone/types';
/**
 * Approve / reject a pending case — the human-in-the-loop gate.
 *
 * The chat pipeline only ever proposes; execution happens here, after a human decides.
 * Permission boundary: cases routed to "manager" can only be decided with role "manager".
 * No real payment is processed — execution calls mock APIs and every step lands in the case's audit trail.
 */
import { createLogger, getOrder } from "../_shared";
import { closeCase, executeCase, makeEmitter } from "../_agents/execution";
import { caseIdFor, getCase } from "../_agents/store";
import { withLocalFallbackStore } from "../_local-store";

const logger = createLogger("approve-refund");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8" },
  });
}

export async function onRequest(rawContext: AgentContext) {
  const context = withLocalFallbackStore(rawContext);
  const body = (context.request?.body ?? {}) as Record<string, any>;
  const { caseId, orderId, decision, role = "support" } = body;
  const id = caseId || (orderId ? caseIdFor(orderId) : "");

  if (!id || (decision !== "approve" && decision !== "reject") || (role !== "support" && role !== "manager")) {
    return json({ error: "Expected { caseId | orderId, decision: 'approve' | 'reject', role: 'support' | 'manager' }" }, 400);
  }

  const c = await getCase(context, id);
  if (!c) return json({ error: `Case ${id} not found` }, 404);
  if (c.status !== "pending_approval") return json({ error: `Case ${id} is not awaiting approval (status: ${c.status})` }, 409);
  if (c.decision.approver === "manager" && role !== "manager") {
    return json({ error: "Manager approval required — switch to the manager role to decide this case.", requiredApprover: "manager" }, 403);
  }

  const order = await getOrder(context, c.orderId);
  if (!order) return json({ error: `Order ${c.orderId} not found` }, 404);

  const env = context.env ?? {};
  const before = c.events.length;
  const emit = makeEmitter(c);
  c.decidedBy = role;

  let updated = order;
  if (decision === "approve") {
    emit("approval", "done", "Approval Layer", `Approved by ${role === "manager" ? "manager" : "support agent"}`, [
      `Case routed to: ${c.decision.approver === "manager" ? "manager" : "support agent"} approval`,
    ]);
    updated = await executeCase(context, env, c, order, emit);
  } else {
    emit("approval", "blocked", "Approval Layer", `Rejected by ${role === "manager" ? "manager" : "support agent"}`);
    updated = await closeCase(context, env, c, order, emit, "rejected");
  }

  logger.log(`Case ${id} ${decision}d by ${role}`);
  return json({ success: true, case: c, order: updated, newEvents: c.events.slice(before) });
}
