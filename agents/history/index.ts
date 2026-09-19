import type { AgentContext } from '@edgeone/types';
/**
 * Conversation history — returns the stored user/assistant messages of the current conversation
 * so the chat UI can restore its transcript after a page reload.
 *
 * The runtime injects `context.conversation_id` from the `makers-conversation-id` header.
 */
import { withLocalFallbackStore } from "../_local-store";

const JSON_HEADERS = { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" };

export async function onRequest(rawContext: AgentContext) {
  const context = withLocalFallbackStore(rawContext);
  const conversationId = context.conversation_id || "";

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (conversationId) {
    try {
      // Fetch the maximum and keep the newest 50 below (the docs don't say which end `limit` truncates).
      const stored = await context.store.getMessages({ conversationId, limit: 100, order: "asc" });
      if (Array.isArray(stored)) {
        for (const m of stored) {
          if ((m?.role === "user" || m?.role === "assistant") && typeof m.content === "string") {
            messages.push({ role: m.role, content: m.content });
          }
        }
      }
    } catch {}
  }

  return new Response(JSON.stringify({ messages: messages.slice(-50) }), { status: 200, headers: JSON_HEADERS });
}
