import type { AgentContext } from '@edgeone/types';
/**
 * List after-sales cases (newest first) — feeds the dashboard, approvals queue and activity feed.
 */
import { listCases } from "../_agents/store";
import { withLocalFallbackStore } from "../_local-store";

export async function onRequest(rawContext: AgentContext) {
  const context = withLocalFallbackStore(rawContext);
  const cases = await listCases(context);
  return new Response(JSON.stringify({ cases }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" },
  });
}
