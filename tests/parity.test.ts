// Parity check: the Python/FastAPI risk & policy service must agree exactly with the TypeScript fallback.
// Usage: start the service (uvicorn index:app --port 8001 in cloud-functions/api), then
//   PY_SERVICE_URL=http://127.0.0.1:8001 npm run test:parity
import { demoCaseOrders } from "../agents/_agents/data";
import { assessRisk, daysSince, evaluatePolicy, findCustomer } from "../agents/_agents/specialists";
import type { Order } from "../agents/_shared";
import type { Issue } from "../agents/_agents/types";

const base = process.env.PY_SERVICE_URL;
if (!base) {
  console.log("SKIP  set PY_SERVICE_URL (e.g. http://127.0.0.1:8001) to compare TypeScript and Python results");
  process.exit(0);
}

const post = async (path: string, body: unknown) => {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
};
const strip = (o: object) => JSON.stringify({ ...o, engine: undefined });

// Demo orders plus edge cases: shipped, already refunded/exchanged, final-sale item.
const base0 = demoCaseOrders();
const orders: Order[] = [
  ...base0,
  { ...base0[0], orderId: "X-SHIPPED", status: "shipped" },
  { ...base0[0], orderId: "X-REFUNDED", status: "refund_approved" },
  { ...base0[0], orderId: "X-EXCHANGED", status: "exchange_shipped" },
  { ...base0[0], orderId: "X-PENDING", status: "pending" },
  { ...base0[0], orderId: "X-CLEARANCE", items: [{ ...base0[0].items[0], name: "Clearance Headphones" }] },
  { ...base0[0], orderId: "X-1DAY", deliveredAt: new Date(Date.now() - 86_400_000).toISOString(), updatedAt: new Date(Date.now() - 86_400_000).toISOString() },
];

let checks = 0;
let failures = 0;
const compare = (name: string, ts: object, py: object) => {
  checks++;
  if (strip(ts) !== strip(py)) {
    failures++;
    console.log(`FAIL  ${name}\n   ts: ${strip(ts)}\n   py: ${strip(py)}`);
  }
};

for (const order of orders) {
  const { customer } = findCustomer(order.userId);
  compare(`risk ${order.orderId}`, assessRisk(customer, order), await post("/risk", {
    refunds_90d: customer.refunds90d,
    damage_claims_90d: customer.damageClaims90d,
    replacements_90d: customer.replacements90d,
    address_mismatch: customer.addressMismatch,
    member_since_days: customer.memberSinceDays,
    order_total: order.totalAmount,
  }));
  for (const issue of ["damaged", "wrong_item", "changed_mind"] as Issue[]) {
    compare(`policy ${order.orderId}/${issue}`, evaluatePolicy(order, issue), await post("/policy", {
      order_status: order.status,
      delivered_days: daysSince(order.deliveredAt ?? order.updatedAt),
      item_text: order.items.map(i => `${i.name} ${i.specs}`).join(" "),
      issue,
    }));
  }
}

console.log(failures === 0 ? `PASS  ${checks} TypeScript/Python parity checks` : `\n${failures} of ${checks} parity checks FAILED`);
process.exit(failures ? 1 : 0);
