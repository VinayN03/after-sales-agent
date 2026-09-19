"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useDirectory, type DirCustomer } from "./directory";
import { initials } from "./helpers";

const TIERS = ["All", "Platinum", "Gold", "Silver", "Standard"] as const;
const TIER_STYLE: Record<DirCustomer["tier"], string> = {
  Platinum: "bg-violet-100 text-violet-700",
  Gold: "bg-amber-100 text-amber-700",
  Silver: "bg-slate-200 text-slate-700",
  Standard: "bg-slate-100 text-slate-600",
};
const RISK_STYLE = { LOW: "bg-emerald-50 text-emerald-700", MEDIUM: "bg-amber-50 text-amber-700", HIGH: "bg-red-50 text-red-600" };
const COLS = "grid-cols-[1.9fr_0.8fr_0.8fr_0.6fr_0.8fr_1fr_0.9fr_0.8fr_24px]";

const memberFor = (days: number) => (days >= 365 ? `${(days / 365).toFixed(1)} yrs` : `${Math.round(days / 30)} mo`);

/** Customer directory: profile, tier, history and account-level risk, with per-customer case counts. */
export function CustomersView({ onOpenApprovals }: { onOpenApprovals: () => void }) {
  const { customers, loaded } = useDirectory();
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<(typeof TIERS)[number]>("All");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      customers
        .filter(c => (tier === "All" || c.tier === tier) && `${c.name} ${c.email} ${c.id}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => b.riskScore - a.riskScore || b.totalCases - a.totalCases),
    [customers, query, tier],
  );

  return (
    <div className="mx-auto max-w-[1400px] px-6 pb-6 pt-2">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-slate-900">Customers</h2>
          <p className="text-[12px] text-slate-500">
            Who the agents are dealing with — profile, history and account-level fraud risk. {customers.length} customers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search customers"
              className="w-40 bg-transparent text-[12px] text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-medium">
            {TIERS.map(t => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`press rounded-md px-2.5 py-1 ${tier === t ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
        <div className="min-w-[860px]">
          <div className={`grid ${COLS} gap-3 border-b border-slate-100 pb-2 text-[11px] font-medium text-slate-400`}>
            <span>Customer</span><span>Tier</span><span>Member</span><span>Orders</span><span>Refunds 90d</span><span>Risk profile</span><span>Cases</span><span>Prefers</span><span />
          </div>

          {rows.map((c, i) => (
            <Fragment key={c.id}>
              <div
                onClick={() => setOpen(open === c.id ? null : c.id)}
                style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                className={`fade-up grid ${COLS} cursor-pointer items-center gap-3 border-b border-slate-50 py-2 text-[12px] hover:bg-slate-50/60`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-semibold text-indigo-600">{initials(c.name)}</div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-800">{c.name}</div>
                    <div className="truncate text-[10px] text-slate-400">{c.email}</div>
                  </div>
                </div>
                <div><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TIER_STYLE[c.tier]}`}>{c.tier}</span></div>
                <div className="text-slate-600">{memberFor(c.memberSinceDays)}</div>
                <div className="tabular-nums text-slate-700">{c.lifetimeOrders}</div>
                <div className={`tabular-nums ${c.refunds90d >= 3 ? "font-semibold text-red-600" : "text-slate-700"}`}>{c.refunds90d}</div>
                <div>
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${RISK_STYLE[c.riskLevel]}`}>
                    {c.riskLevel} · {c.riskScore}
                  </span>
                </div>
                <div className="tabular-nums text-slate-700">
                  {c.totalCases}
                  {c.openCases > 0 && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{c.openCases} open</span>}
                </div>
                <div className="capitalize text-slate-600">{c.preferredChannel}</div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open === c.id ? "rotate-180" : ""}`} />
              </div>

              {open === c.id && (
                <div className="fade-up grid gap-4 border-b border-slate-100 bg-slate-50/60 px-3 py-3 text-[11.5px] text-slate-600 md:grid-cols-3">
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Contact & payment</div>
                    <div>{c.email}</div>
                    <div>{c.phone}</div>
                    <div>{c.payment}</div>
                    <div className="mt-1 text-slate-400">{c.id}</div>
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Support history</div>
                    {c.pastCases.length ? c.pastCases.map((p, k) => <div key={k}>{p.date} — {p.topic}</div>) : <div className="text-slate-400">No previous cases</div>}
                    <div className="mt-1 text-slate-400">
                      {c.damageClaims90d} damage claims · {c.replacements90d} replacements (90 days)
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Account risk factors</div>
                    {c.riskFlags.length ? c.riskFlags.map((f, k) => <div key={k}>⚠ {f}</div>) : <div className="text-emerald-700">✓ No suspicious pattern</div>}
                    {c.openCases > 0 && (
                      <button onClick={onOpenApprovals} className="press mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100">
                        Review {c.openCases} open case{c.openCases > 1 ? "s" : ""}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Fragment>
          ))}

          {loaded && rows.length === 0 && <div className="py-10 text-center text-[12px] text-slate-400">No customers match.</div>}
          {!loaded && <div className="py-10 text-center text-[12px] text-slate-400">Loading customers…</div>}
        </div>
      </div>
    </div>
  );
}
