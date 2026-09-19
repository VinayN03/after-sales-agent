import type { AgentContext } from '@edgeone/types';
import type { BaseStore } from '@langchain/langgraph';
import type { Case } from "./types";

export const CASES_NAMESPACE = ["aftersales", "cases"];

export const caseIdFor = (orderId: string) => `CASE-${orderId}`;

export async function saveCase(context: AgentContext, c: Case): Promise<void> {
  c.updatedAt = new Date().toISOString();
  await (context.store.langgraphStore as BaseStore).put(CASES_NAMESPACE, c.caseId, { ...c });
}

export async function getCase(context: AgentContext, caseId: string): Promise<Case | null> {
  try {
    const item = await (context.store.langgraphStore as BaseStore).get(CASES_NAMESPACE, caseId);
    return (item?.value as Case) ?? null;
  } catch {
    return null;
  }
}
