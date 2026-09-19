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
};

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

function mk(orderId: string, userId: string, items: OrderItem[], deliveredDaysAgo: number): Order {
  return {
    orderId,
    userId,
    items,
    totalAmount: Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100,
    status: "delivered",
    createdAt: ago(deliveredDaysAgo + 4),
    updatedAt: ago(deliveredDaysAgo),
    deliveredAt: ago(deliveredDaysAgo),
    trackingNumber: `1Z${orderId.slice(-3)}84R${deliveredDaysAgo}0341`,
    carrier: "UPS",
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
  ];
}

/** Seed the demo orders into the store (idempotent; also maintains the orders manifest). */
export async function ensureDemoOrders(context: AgentContext): Promise<void> {
  const kv = context?.store?.langgraphStore as BaseStore | undefined;
  if (!kv) return;
  try {
    const orders = demoCaseOrders();
    if (await kv.get(ORDERS_NAMESPACE, orders[0].orderId)) return;
    await Promise.all(orders.map(o => kv.put(ORDERS_NAMESPACE, o.orderId, { ...o })));
    const idx = await kv.get(ORDERS_MANIFEST_NAMESPACE, MANIFEST_KEY).catch(() => null);
    const ids = [...new Set([...((idx?.value?.ids as string[]) ?? []), ...orders.map(o => o.orderId)])];
    await kv.put(ORDERS_MANIFEST_NAMESPACE, MANIFEST_KEY, { ids });
  } catch {}
}
