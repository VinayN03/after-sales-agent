import type { AgentContext } from '@edgeone/types';
import type { BaseStore } from '@langchain/langgraph';
/**
 * Directory — customers, orders (with the case attached to each) and the assistant's configuration.
 * Feeds the Customers, Orders and Settings screens.
 */
import type { Order } from "../_shared";
import { MANIFEST_KEY, ORDERS_MANIFEST_NAMESPACE, ORDERS_NAMESPACE } from "../_data/orders";
import { CUSTOMERS, ensureDemoOrders } from "../_agents/data";
import { AUTONOMOUS_BELOW, SUPPORT_APPROVAL_UP_TO } from "../_agents/decision";
import { CREDIT_BONUS } from "../_agents/resolution";
import { ensureDemoCases } from "../_agents/seed";
import { RETURN_WINDOW_DAYS, assessRisk } from "../_agents/specialists";
import { listCases } from "../_agents/store";
import { GRANTS, TOOLS, type ToolName } from "../_agents/tools";
import { withLocalFallbackStore } from "../_local-store";

/** Mirrors the weights in assessRisk() / the Python risk service — shown on the Settings screen. */
const RISK_FACTORS = [
  { label: "3+ refunds in the last 90 days", weight: 35 },
  { label: "3+ damage claims in the last 90 days", weight: 25 },
  { label: "Shipping address differs from billing", weight: 20 },
  { label: "2+ replacements in the last 90 days", weight: 10 },
  { label: "Account under 30 days old", weight: 10 },
  { label: "Order over $250", weight: 10 },
];

async function listOrders(context: AgentContext): Promise<Order[]> {
  const kv = context.store?.langgraphStore as BaseStore | undefined;
  if (!kv) return [];
  try {
    const idx = await kv.get(ORDERS_MANIFEST_NAMESPACE, MANIFEST_KEY).catch(() => null);
    const ids = ((idx?.value as { ids?: string[] } | undefined)?.ids ?? []) as string[];
    const items = await Promise.all(ids.map(id => kv.get(ORDERS_NAMESPACE, id).catch(() => null)));
    return items
      .map(i => i?.value as Order | undefined)
      .filter((o): o is Order => !!o)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function onRequest(rawContext: AgentContext) {
  const context = withLocalFallbackStore(rawContext);
  const env = context.env ?? {};

  await ensureDemoOrders(context);
  await ensureDemoCases(context);
  const [orders, cases] = await Promise.all([listOrders(context), listCases(context, 200)]);

  const caseByOrder = new Map(cases.map(c => [c.orderId, c]));
  const casesByCustomer = new Map<string, { open: number; total: number }>();
  for (const c of cases) {
    const s = casesByCustomer.get(c.customer.id) ?? { open: 0, total: 0 };
    s.total++;
    if (c.status === "pending_approval") s.open++;
    casesByCustomer.set(c.customer.id, s);
  }

  const customers = Object.values(CUSTOMERS).map(cu => {
    const risk = assessRisk(cu, { totalAmount: 0 } as Order); // account-level risk profile (no order value)
    const stats = casesByCustomer.get(cu.id) ?? { open: 0, total: 0 };
    return { ...cu, riskLevel: risk.level, riskScore: risk.score, riskFlags: risk.flags, openCases: stats.open, totalCases: stats.total };
  });

  const orderRows = orders.map(o => {
    const c = caseByOrder.get(o.orderId);
    return {
      orderId: o.orderId,
      userId: o.userId,
      customerName: CUSTOMERS[o.userId]?.name ?? o.userId,
      items: o.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
      totalAmount: o.totalAmount,
      status: o.status,
      createdAt: o.createdAt,
      deliveredAt: o.deliveredAt,
      trackingNumber: o.trackingNumber,
      carrier: o.carrier,
      caseId: c?.caseId,
      caseStatus: c?.status,
      caseRoute: c?.decision.route,
    };
  });

  const settings = {
    autonomy: { autonomousBelow: AUTONOMOUS_BELOW, supportApprovalUpTo: SUPPORT_APPROVAL_UP_TO },
    policy: { returnWindowDays: RETURN_WINDOW_DAYS, creditBonusPct: Math.round(CREDIT_BONUS * 100) },
    risk: { mediumAt: 30, highAt: 60, factors: RISK_FACTORS },
    integrations: {
      model: env.AI_GATEWAY_MODEL || env.AI_MODEL || "@makers/deepseek-v4-flash",
      gatewayConfigured: !!(env.AI_GATEWAY_API_KEY && env.AI_GATEWAY_BASE_URL),
    },
    tools: (Object.keys(TOOLS) as ToolName[]).map(name => ({
      name,
      description: TOOLS[name].description,
      scope: TOOLS[name].scope,
      requiresApproval: "requiresApproval" in TOOLS[name] && !!TOOLS[name].requiresApproval,
      grantedTo: (Object.keys(GRANTS) as Array<keyof typeof GRANTS>).filter(agent => GRANTS[agent].includes(name)),
    })),
    operators: {
      supportPasscodeSet: !!env.SUPPORT_PASSCODE,
      managerPasscodeSet: !!env.MANAGER_PASSCODE,
      usingDemoDefaults: !env.SUPPORT_PASSCODE || !env.MANAGER_PASSCODE,
    },
  };

  return new Response(JSON.stringify({ customers, orders: orderRows, settings }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" },
  });
}
