import type { AgentContext } from '@edgeone/types';
import type { BaseStore } from '@langchain/langgraph';
import type { Case } from "./types";

export const CASES_NAMESPACE = ["aftersales", "cases"];
// A manifest of case IDs, so listing doesn't depend on kv.search() (not reliable on every KV backend).
export const CASES_MANIFEST_NAMESPACE = ["aftersales", "cases_manifest"];

export const caseIdFor = (orderId: string) => `CASE-${orderId}`;

export async function saveCase(context: AgentContext, c: Case): Promise<void> {
  c.updatedAt = new Date().toISOString();
  const kv = context.store.langgraphStore as BaseStore;
  await kv.put(CASES_NAMESPACE, c.caseId, { ...c });
  try {
    const idx = await kv.get(CASES_MANIFEST_NAMESPACE, "all").catch(() => null);
    const ids: string[] = (idx?.value?.ids as string[]) ?? [];
    if (!ids.includes(c.caseId)) await kv.put(CASES_MANIFEST_NAMESPACE, "all", { ids: [...ids, c.caseId] });
  } catch {}
}

export async function getCase(context: AgentContext, caseId: string): Promise<Case | null> {
  try {
    const item = await (context.store.langgraphStore as BaseStore).get(CASES_NAMESPACE, caseId);
    return (item?.value as Case) ?? null;
  } catch {
    return null;
  }
}

/** All cases, newest first. */
export async function listCases(context: AgentContext, limit = 50): Promise<Case[]> {
  const kv = context.store?.langgraphStore as BaseStore | undefined;
  if (!kv) return [];
  try {
    const idx = await kv.get(CASES_MANIFEST_NAMESPACE, "all").catch(() => null);
    const ids: string[] = (idx?.value?.ids as string[]) ?? [];
    const items = await Promise.all(ids.map(id => kv.get(CASES_NAMESPACE, id).catch(() => null)));
    return items
      .map(i => i?.value as Case | undefined)
      .filter((c): c is Case => !!c)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  } catch {
    return [];
  }
}
