import type { AgentContext } from '@edgeone/types';
import type { BaseStore } from '@langchain/langgraph';
/**
 * Historical demo cases, so the dashboard, approvals inbox, analytics and activity feed are populated
 * from the first page load. Each one is produced by the REAL pipeline (specialists, decision engine,
 * approval/execution/audit, tool registry) — only the model is switched off (env = {}), so seeding
 * costs no tokens — and is then back-dated so the timeline looks like a working day.
 *
 * It uses dedicated orders (ORD-…-2xx) and never touches the six live-demo scenarios (ORD-…-101…106).
 * A marker in KV makes it run once; Reset clears the marker so the next load re-seeds.
 */
import { saveDoc } from "../../lib/doc-store";
import { getDemoDocs } from "../_data/demo-docs";
import { createLogger, getOrder } from "../_shared";
import { ensureDemoOrders } from "./data";
import { closeCase, executeCase, makeEmitter } from "./execution";
import { runRefundPipeline } from "./pipeline";
import { CASES_NAMESPACE } from "./store";
import type { Case } from "./types";

const logger = createLogger("seed");
export const META_NAMESPACE = ["aftersales", "meta"];

interface SeedSpec {
  orderId: string;
  message: string;
  minutesAgo: number;
  decide?: { role: "support" | "manager"; action: "approve" | "reject" };
}

// Oldest first, so the manifest (and therefore the list order) reads naturally.
const SEEDS: SeedSpec[] = [
  { orderId: "ORD-20260805-209", minutesAgo: 340, message: "I changed my mind about the bedding set from ORD-20260805-209. Can I get a refund?" },
  { orderId: "ORD-20260910-201", minutesAgo: 300, decide: { role: "support", action: "approve" }, message: "The Bluetooth speaker from ORD-20260910-201 arrived damaged, the left side is cracked. I'd like a refund." },
  { orderId: "ORD-20260911-202", minutesAgo: 255, decide: { role: "support", action: "approve" }, message: "The keyboard from ORD-20260911-202 has keys that don't register. Please refund it." },
  { orderId: "ORD-20260912-203", minutesAgo: 210, decide: { role: "manager", action: "approve" }, message: "The standing desk converter from ORD-20260912-203 is missing hardware and wobbles. I want my money back." },
  { orderId: "ORD-20260908-208", minutesAgo: 175, decide: { role: "support", action: "reject" }, message: "The gaming headset from ORD-20260908-208 broke where the headband meets the ear cup. I want a refund." },
  { orderId: "ORD-20260913-204", minutesAgo: 130, message: "The phone case from ORD-20260913-204 doesn't fit and arrived scratched. Refund please." },
  { orderId: "ORD-20260914-205", minutesAgo: 95, message: "The ergonomic mouse from ORD-20260914-205 stopped working after two days." },
  { orderId: "ORD-20260915-206", minutesAgo: 50, message: "The earbuds from ORD-20260915-206 have a crackling sound on the left side. I'd like a refund." },
  { orderId: "ORD-20260916-207", minutesAgo: 22, message: "The yoga mat from ORD-20260916-207 arrived with a tear along the edge. Refund please." },
];

function backdate(c: Case, minutes: number) {
  const shift = (iso: string) => new Date(new Date(iso).getTime() - minutes * 60_000).toISOString();
  c.createdAt = shift(c.createdAt);
  c.updatedAt = shift(c.updatedAt);
  for (const e of c.events) e.ts = shift(e.ts);
  for (const t of c.toolCalls ?? []) t.ts = shift(t.ts);
}

/**
 * Knowledge-base policy documents, pre-loaded WITHOUT a model call: the summary is simply the document's
 * opening, so the Knowledge base isn't empty and the FAQ path has something to route to. (The "Import demo
 * data" button in the panel still works and generates model-written summaries.)
 */
async function seedDocs(context: AgentContext, kv: BaseStore): Promise<void> {
  if (await kv.get(META_NAMESPACE, "docs_seeded")) return;
  for (const doc of getDemoDocs("en")) {
    if (doc.category === "order_doc") continue; // orders are seeded separately
    const slug = doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const oneLine = doc.content.replace(/\s+/g, " ").trim();
    const summary = `${doc.title}: ${oneLine.slice(0, 160)}${oneLine.length > 160 ? "…" : ""}`;
    const keywords = [...new Set([doc.category, ...doc.title.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2)])].slice(0, 6);
    await saveDoc(context.store, doc.category, `demo-${doc.category}-${slug}`, doc.title, doc.content, summary, keywords);
  }
  await kv.put(META_NAMESPACE, "docs_seeded", { at: new Date().toISOString() });
}

let inflight: Promise<void> | null = null;

/** Seed once (concurrent callers share one run). Safe to call on every list request. */
export function ensureDemoCases(context: AgentContext): Promise<void> {
  return (inflight ??= seed(context).finally(() => {
    inflight = null;
  }));
}

async function seed(context: AgentContext): Promise<void> {
  const kv = context?.store?.langgraphStore as BaseStore | undefined;
  if (!kv) return;
  try {
    await seedDocs(context, kv);
    if (await kv.get(META_NAMESPACE, "seeded")) return;
    await ensureDemoOrders(context);

    for (const s of SEEDS) {
      const order = await getOrder(context, s.orderId);
      if (!order || order.status !== "delivered") continue; // already used (e.g. by a live run)

      const res = await runRefundPipeline({ order, userMessage: s.message, context, env: {} });
      const c = (res.cardEvent as unknown as { data: { case: Case } }).data.case;
      let current = res.currentOrder;

      if (s.decide) {
        const emit = makeEmitter(c);
        const who = s.decide.role === "manager" ? "manager" : "support agent";
        c.decidedBy = s.decide.role;
        if (s.decide.action === "approve") {
          emit("approval", "done", "Approval Layer", `Approved by ${who}`, [
            `Case routed to: ${c.decision.approver === "manager" ? "manager" : "support agent"} approval`,
          ]);
          current = await executeCase(context, {}, c, current, emit);
        } else {
          emit("approval", "blocked", "Approval Layer", `Rejected by ${who}`);
          current = await closeCase(context, {}, c, current, emit, "rejected");
        }
      }

      backdate(c, s.minutesAgo);
      await kv.put(CASES_NAMESPACE, c.caseId, { ...c }); // written directly so the back-dated updatedAt sticks
    }

    await kv.put(META_NAMESPACE, "seeded", { at: new Date().toISOString() });
  } catch (e) {
    logger.error("Seeding demo cases failed:", (e as Error).message);
  }
}
