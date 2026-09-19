import type { AgentContext } from '@edgeone/types';
import type { BaseStore } from '@langchain/langgraph';
import { withLocalFallbackStore } from "../_local-store";
import { verifyManager } from "../_agents/auth";
/**
 * Reset all application-owned data for the after-sales assistant.
 *
 * This intentionally clears conversations, workflow state, knowledge-base
 * documents, and orders, while leaving unrelated runtime data untouched.
 */

const WORKFLOW_NAMESPACE = ["aftersales", "workflow"];
const DOCUMENT_NAMESPACE = ["kb", "doc"];
const DOCUMENT_MANIFEST_NAMESPACE = ["kb", "doc_manifest"];
const ORDER_NAMESPACE = ["aftersales", "orders"];
const ORDER_MANIFEST_NAMESPACE = ["aftersales", "orders_manifest"];

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function clearNamespace(kv: any, namespace: string[]): Promise<number> {
  let deleted = 0;

  while (true) {
    const items = await kv.search(namespace, { limit: 100 });
    if (!Array.isArray(items) || items.length === 0) break;

    await Promise.all(items.map((item: any) => kv.delete(item.namespace, item.key)));
    deleted += items.length;
  }

  return deleted;
}

async function clearConversations(store: any): Promise<number> {
  let deleted = 0;

  while (true) {
    const page = await store.listConversations({ limit: 100 });
    const conversations = page?.items ?? [];
    if (conversations.length === 0) break;

    await Promise.all(
      conversations.map((conversation: { conversationId: string }) =>
        store.deleteConversation({ conversationId: conversation.conversationId })
      )
    );
    deleted += conversations.length;
  }

  return deleted;
}

export async function onRequest(rawContext: AgentContext) {
  const context = withLocalFallbackStore(rawContext);

  // Destructive, manager-only operation: require the manager passcode before touching the store.
  const { passcode } = ((context.request?.body ?? {}) as Record<string, any>);
  if (!verifyManager(context.env ?? {}, passcode)) {
    return jsonResponse({ error: "Manager passcode required." }, 401);
  }

  const store = context.store ?? null;
  if (!store) {
    return jsonResponse({
      error: "STORE_NOT_CONFIGURED",
      message: "Storage is not available. Deploy to EdgeOne Makers for automatic configuration.",
    }, 503);
  }

  try {
    const kv = store.langgraphStore as BaseStore;
    const conversations = await clearConversations(store);
    const workflowRecords = await clearNamespace(kv, WORKFLOW_NAMESPACE);
    const documents = await clearNamespace(kv, DOCUMENT_NAMESPACE);
    const orders = await clearNamespace(kv, ORDER_NAMESPACE);
    const cases = await clearNamespace(kv, ["aftersales", "cases"]);

    await Promise.all([
      kv.delete(DOCUMENT_MANIFEST_NAMESPACE, "all"),
      kv.delete(ORDER_MANIFEST_NAMESPACE, "all"),
      kv.delete(["aftersales", "cases_manifest"], "all"),
      kv.delete(["aftersales", "meta"], "seeded"), // re-seed the historical demo cases on the next load
      kv.delete(["aftersales", "meta"], "docs_seeded"), // ...and the knowledge-base documents
    ]);

    return jsonResponse({
      success: true,
      deleted: { conversations, workflowRecords, documents, orders, cases },
    });
  } catch (e) {
    console.error("[reset] Reset error:", (e as Error).message);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
}
