import type { AgentContext } from '@edgeone/types';
import type { BaseStore } from '@langchain/langgraph';
/**
 * Mock customers and demo orders for the after-sales multi-agent demo.
 *
 * Orders are seeded lazily (ensureDemoOrders) the first time the store is touched, with dates
 * relative to "now" so the 30-day return window behaves the same whenever the demo is run.
 */
import type { Order, OrderItem } from "../_shared";
import type { Customer } from "./types";
import { ORDERS_NAMESPACE, ORDERS_MANIFEST_NAMESPACE, MANIFEST_KEY } from "../_data/orders";

export const CUSTOMERS: Record<string, Customer> = {
  "CUST-7821": {
    id: "CUST-7821", name: "Vinay Kumar", email: "vinay.kumar@example.com", phone: "+1 415-555-0142",
    tier: "Gold", memberSinceDays: 900, lifetimeOrders: 3,
    pastCases: [{ date: "Jan 12", topic: "Wrong size" }, { date: "Mar 04", topic: "Shipping delay" }],
    refunds90d: 0, damageClaims90d: 0, replacements90d: 0, addressMismatch: false,
    preferredChannel: "email", payment: "Visa ****4242",
  },
  "CUST-4410": {
    id: "CUST-4410", name: "Maya Chen", email: "maya.chen@example.com", phone: "+1 628-555-0188",
    tier: "Silver", memberSinceDays: 400, lifetimeOrders: 8,
    pastCases: [{ date: "Jun 02", topic: "Late delivery" }],
    refunds90d: 0, damageClaims90d: 0, replacements90d: 0, addressMismatch: false,
    preferredChannel: "sms", payment: "Mastercard ****1187",
  },
  "CUST-9032": {
    id: "CUST-9032", name: "Daniel Ortiz", email: "daniel.ortiz@example.com", phone: "+1 510-555-0166",
    tier: "Platinum", memberSinceDays: 1500, lifetimeOrders: 42,
    pastCases: [{ date: "Feb 19", topic: "Damaged packaging" }, { date: "Aug 11", topic: "Warranty question" }],
    refunds90d: 1, damageClaims90d: 0, replacements90d: 0, addressMismatch: false,
    preferredChannel: "email", payment: "Amex ****3005",
  },
  "CUST-1567": {
    id: "CUST-1567", name: "Riley Stone", email: "riley.stone@example.com", phone: "+1 213-555-0199",
    tier: "Standard", memberSinceDays: 21, lifetimeOrders: 6,
    pastCases: [
      { date: "Aug 30", topic: "Damaged item — refunded" }, { date: "Sep 03", topic: "Damaged item — refunded" },
      { date: "Sep 09", topic: "Damaged item — replaced" }, { date: "Sep 12", topic: "Item not received — refunded" },
    ],
    refunds90d: 4, damageClaims90d: 3, replacements90d: 2, addressMismatch: true,
    preferredChannel: "chat", payment: "Visa ****9910",
  },
  "CUST-3305": {
    id: "CUST-3305", name: "Priya Nair", email: "priya.nair@example.com", phone: "+1 408-555-0121",
    tier: "Gold", memberSinceDays: 700, lifetimeOrders: 12,
    pastCases: [{ date: "Apr 08", topic: "Wrong colour" }],
    refunds90d: 0, damageClaims90d: 0, replacements90d: 0, addressMismatch: false,
    preferredChannel: "email", payment: "Visa ****7734",
  },
  "CUST-5120": {
    id: "CUST-5120", name: "Marcus Webb", email: "marcus.webb@example.com", phone: "+1 650-555-0175",
    tier: "Silver", memberSinceDays: 320, lifetimeOrders: 5,
    pastCases: [{ date: "Jul 21", topic: "Late delivery" }],
    refunds90d: 1, damageClaims90d: 0, replacements90d: 0, addressMismatch: false,
    preferredChannel: "sms", payment: "Mastercard ****4409",
  },
  "CUST-6644": {
    id: "CUST-6644", name: "Aisha Rahman", email: "aisha.rahman@example.com", phone: "+1 925-555-0134",
    tier: "Platinum", memberSinceDays: 1100, lifetimeOrders: 27,
    pastCases: [{ date: "Jan 30", topic: "Warranty question" }, { date: "May 17", topic: "Damaged packaging" }],
    refunds90d: 0, damageClaims90d: 0, replacements90d: 0, addressMismatch: false,
    preferredChannel: "email", payment: "Amex ****8812",
  },
  "CUST-2789": {
    id: "CUST-2789", name: "Tom Becker", email: "tom.becker@example.com", phone: "+1 707-555-0152",
    tier: "Standard", memberSinceDays: 60, lifetimeOrders: 2,
    pastCases: [],
    refunds90d: 1, damageClaims90d: 1, replacements90d: 0, addressMismatch: false,
    preferredChannel: "chat", payment: "Visa ****2231",
  },
  "CUST-8143": {
    id: "CUST-8143", name: "Sofia Lopez", email: "sofia.lopez@example.com", phone: "+1 831-555-0108",
    tier: "Silver", memberSinceDays: 500, lifetimeOrders: 9,
    pastCases: [{ date: "Mar 12", topic: "Missing accessory" }],
    refunds90d: 0, damageClaims90d: 0, replacements90d: 0, addressMismatch: false,
    preferredChannel: "chat", payment: "Mastercard ****6620",
  },
  "CUST-7302": {
    id: "CUST-7302", name: "Kenji Tanaka", email: "kenji.tanaka@example.com", phone: "+1 415-555-0190",
    tier: "Gold", memberSinceDays: 850, lifetimeOrders: 15,
    pastCases: [{ date: "Feb 25", topic: "Shipping delay" }],
    refunds90d: 0, damageClaims90d: 0, replacements90d: 0, addressMismatch: false,
    preferredChannel: "sms", payment: "Visa ****0958",
  },
};

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

function mk(orderId: string, userId: string, items: OrderItem[], daysAgo: number, status: Order["status"] = "delivered"): Order {
  const delivered = status === "delivered";
  return {
    orderId,
    userId,
    items,
    totalAmount: Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100,
    status,
    createdAt: ago(daysAgo + (delivered ? 4 : 1)),
    updatedAt: ago(daysAgo),
    ...(delivered ? { deliveredAt: ago(daysAgo) } : {}),
    ...(status === "pending" ? {} : { trackingNumber: `1Z${orderId.slice(-3)}84R${daysAgo}0341`, carrier: "UPS" }),
    payment: CUSTOMERS[userId]?.payment,
  };
}

/** One order per demo scenario: human approval, autonomous, manager approval, high risk, outside window. */
export function demoCaseOrders(): Order[] {
  return [
    mk("ORD-20260914-101", "CUST-7821", [{ productId: "P101", name: "Wireless Noise-Cancelling Headphones", specs: "Black", quantity: 1, price: 127.4 }], 3),
    mk("ORD-20260916-102", "CUST-4410", [{ productId: "P102", name: "USB-C Cable Set (3-pack)", specs: "1m / Braided", quantity: 1, price: 29.99 }], 2),
    mk("ORD-20260905-103", "CUST-9032", [{ productId: "P103", name: "27in 4K Monitor", specs: "IPS / 60Hz", quantity: 1, price: 389 }], 6),
    mk("ORD-20260917-104", "CUST-1567", [{ productId: "P104", name: "Smart Watch Series 5", specs: "Graphite / 44mm", quantity: 1, price: 219 }], 1),
    mk("ORD-20260720-105", "CUST-4410", [{ productId: "P105", name: "LED Desk Lamp", specs: "White", quantity: 1, price: 45 }], 60),
    mk("ORD-20260915-106", "CUST-9032", [{ productId: "P106", name: "Espresso Machine Pro", specs: "Stainless / 15 bar", quantity: 1, price: 329 }], 4),

    // Orders behind the pre-seeded historical cases (see seed.ts) — keeps the dashboard populated
    // while the six scenarios above stay untouched for live demos.
    mk("ORD-20260910-201", "CUST-3305", [{ productId: "P201", name: "Bluetooth Speaker Mini", specs: "Teal", quantity: 1, price: 64.9 }], 8),
    mk("ORD-20260911-202", "CUST-5120", [{ productId: "P202", name: "Mechanical Keyboard K8", specs: "Red switch / 87-key", quantity: 1, price: 89 }], 7),
    mk("ORD-20260912-203", "CUST-6644", [{ productId: "P203", name: "Standing Desk Converter", specs: "Walnut / 32in", quantity: 1, price: 279 }], 6),
    mk("ORD-20260913-204", "CUST-2789", [{ productId: "P204", name: "Phone Case (2-pack)", specs: "Clear / Pro Max", quantity: 1, price: 18.5 }], 5),
    mk("ORD-20260914-205", "CUST-8143", [{ productId: "P205", name: "Ergonomic Mouse", specs: "Graphite / wireless", quantity: 1, price: 42 }], 4),
    mk("ORD-20260915-206", "CUST-7302", [{ productId: "P206", name: "Noise-Cancelling Earbuds", specs: "White", quantity: 1, price: 159 }], 3),
    mk("ORD-20260916-207", "CUST-3305", [{ productId: "P207", name: "Yoga Mat Pro", specs: "6mm / Indigo", quantity: 1, price: 58 }], 2),
    mk("ORD-20260908-208", "CUST-5120", [{ productId: "P208", name: "Gaming Headset", specs: "7.1 / Black", quantity: 1, price: 74 }], 9),
    mk("ORD-20260805-209", "CUST-8143", [{ productId: "P209", name: "Cotton Bedding Set", specs: "Queen / Sage", quantity: 1, price: 95 }], 45),

    // Orders without a case: in transit and processing, to make the Orders view realistic.
    mk("ORD-20260918-210", "CUST-7302", [{ productId: "P210", name: "Smart Plug (4-pack)", specs: "Wi-Fi", quantity: 1, price: 34.99 }], 1, "shipped"),
    mk("ORD-20260919-211", "CUST-6644", [{ productId: "P211", name: "Air Purifier", specs: "HEPA / 400 sq ft", quantity: 1, price: 199 }], 0, "pending"),
    mk("ORD-20260917-212", "CUST-8143", [{ productId: "P212", name: "Travel Backpack", specs: "35L / Slate", quantity: 1, price: 79 }], 2, "shipped"),
    mk("ORD-20260913-213", "CUST-3305", [{ productId: "P213", name: "Desk Organizer", specs: "Bamboo", quantity: 1, price: 24 }], 5),
  ];
}

/** Seed the demo orders into the store (idempotent; also maintains the orders manifest). */
export async function ensureDemoOrders(context: AgentContext): Promise<void> {
  const kv = context?.store?.langgraphStore as BaseStore | undefined;
  if (!kv) return;
  try {
    const orders = demoCaseOrders();
    // Cheap check: the first and last demo orders both present means everything is seeded.
    const [first, last] = await Promise.all([
      kv.get(ORDERS_NAMESPACE, orders[0].orderId),
      kv.get(ORDERS_NAMESPACE, orders[orders.length - 1].orderId),
    ]);
    if (first && last) return;
    // Add only the missing orders, so orders already used by a live demo keep their state.
    const missing = (await Promise.all(orders.map(async o => ((await kv.get(ORDERS_NAMESPACE, o.orderId)) ? null : o)))).filter((o): o is Order => o !== null);
    await Promise.all(missing.map(o => kv.put(ORDERS_NAMESPACE, o.orderId, { ...o })));
    const idx = await kv.get(ORDERS_MANIFEST_NAMESPACE, MANIFEST_KEY).catch(() => null);
    const ids = [...new Set([...((idx?.value?.ids as string[]) ?? []), ...orders.map(o => o.orderId)])];
    await kv.put(ORDERS_MANIFEST_NAMESPACE, MANIFEST_KEY, { ids });
  } catch {}
}
