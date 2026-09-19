"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useDirectory, type DirOrder } from "./directory";
import { fmtDate, money } from "./helpers";

const STATUS: Record<string, { label: string; cls: string }> = {
  delivered: { label: "Delivered", cls: "bg-emerald-50 text-emerald-700" },
  shipped: { label: "In transit", cls: "bg-sky-50 text-sky-700" },
  pending: { label: "Processing", cls: "bg-amber-50 text-amber-700" },
  refund_requested: { label: "Refund in review", cls: "bg-orange-50 text-orange-700" },
  refund_approved: { label: "Refunded", cls: "bg-emerald-100 text-emerald-800" },
  refund_rejected: { label: "Refund declined", cls: "bg-rose-50 text-rose-700" },
  refund_completed: { label: "Refunded", cls: "bg-emerald-100 text-emerald-800" },
  exchange_shipped: { label: "Replacement sent", cls: "bg-violet-50 text-violet-700" },
  exchange_requested: { label: "Exchange requested", cls: "bg-violet-50 text-violet-700" },
};
const CASE_STYLE = {
  pending_approval: { label: "Awaiting approval", cls: "bg-amber-50 text-amber-700" },
  executed: { label: "Resolved", cls: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rejected", cls: "bg-rose-50 text-rose-600" },
  denied: { label: "Denied", cls: "bg-slate-100 text-slate-600" },
} as const;

const FILTERS = ["All", "Delivered", "In transit", "Processing", "With a case"] as const;
const COLS = "grid-cols-[1.15fr_1.2fr_1.9fr_0.7fr_1fr_0.9fr_1.25fr_1.05fr_1fr]";

/** Orders with their fulfilment status and the after-sales case attached to each. */
export function OrdersView({ onAsk, onOpenApprovals }: { onAsk: (text: string) => void; onOpenApprovals: () => void }) {
  const { orders, loaded } = useDirectory();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const rows = useMemo(
    () =>
      orders.filter(o => {
        const text = `${o.orderId} ${o.customerName} ${o.items.map(i => i.name).join(" ")}`.toLowerCase();
        if (!text.includes(query.toLowerCase())) return false;
        if (filter === "Delivered") return o.status === "delivered";
        if (filter === "In transit") return o.status === "shipped";
        if (filter === "Processing") return o.status === "pending";
        if (filter === "With a case") return !!o.caseId;
        return true;
      }),
    [orders, query, filter],
  );

  const refundable = (o: DirOrder) => !o.caseId && (o.status === "delivered" || o.status === "shipped");

  return (
    <div className="mx-auto max-w-[1400px] px-6 pb-6 pt-2">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-slate-900">Orders</h2>
          <p className="text-[12px] text-slate-500">
            Every order the agents can act on, with the after-sales case attached. {orders.length} orders · {orders.filter(o => o.caseId).length} with a case.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search orders"
              className="w-40 bg-transparent text-[12px] text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-medium">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`press rounded-md px-2.5 py-1 ${filter === f ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
        <div className="min-w-[980px]">
          <div className={`grid ${COLS} gap-3 border-b border-slate-100 pb-2 text-[11px] font-medium text-slate-400`}>
            <span>Order</span><span>Customer</span><span>Items</span><span>Amount</span><span>Status</span><span>Placed</span><span>Tracking</span><span>Case</span><span />
          </div>

          {rows.map((o, i) => {
            const status = STATUS[o.status] ?? { label: o.status, cls: "bg-slate-100 text-slate-600" };
            const kase = o.caseStatus ? CASE_STYLE[o.caseStatus] : null;
            return (
              <div
                key={o.orderId}
                style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                className={`fade-up grid ${COLS} items-center gap-3 border-b border-slate-50 py-2 text-[12px] hover:bg-slate-50/60`}
              >
                <div className="font-mono text-[11px] font-medium text-slate-800">{o.orderId}</div>
                <div className="truncate text-slate-700">{o.customerName}</div>
                <div className="truncate text-slate-600" title={o.items.map(it => it.name).join(", ")}>
                  {o.items.map(it => `${it.quantity > 1 ? `${it.quantity}× ` : ""}${it.name}`).join(", ")}
                </div>
                <div className="font-medium tabular-nums text-slate-800">{money(o.totalAmount)}</div>
                <div><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${status.cls}`}>{status.label}</span></div>
                <div className="text-slate-500">{fmtDate(o.createdAt)}</div>
                <div className="truncate text-[11px] text-slate-500">{o.trackingNumber ? `${o.carrier ?? ""} ${o.trackingNumber}`.trim() : "—"}</div>
                <div>
                  {kase ? (
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${kase.cls}`}>{kase.label}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </div>
                <div className="text-right">
                  {refundable(o) && (
                    <button
                      onClick={() => onAsk(`The ${o.items[0]?.name ?? "item"} from order ${o.orderId} arrived damaged. I'd like a refund.`)}
                      className="press rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      Start refund
                    </button>
                  )}
                  {o.caseId && (
                    <button onClick={onOpenApprovals} className="press rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
                      View case
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {loaded && rows.length === 0 && <div className="py-10 text-center text-[12px] text-slate-400">No orders match.</div>}
          {!loaded && <div className="py-10 text-center text-[12px] text-slate-400">Loading orders…</div>}
        </div>
      </div>
    </div>
  );
}
