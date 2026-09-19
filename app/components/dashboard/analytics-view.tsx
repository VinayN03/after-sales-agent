"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Activity, BarChart3, Ban, DollarSign, ShieldCheck, Users, Wrench } from "lucide-react";
import type { Case, CaseStatus, Customer, ResolutionAction, Route, ToolScope } from "../../../agents/_agents/types";

/* ------------------------------------------------------------------ */
/* Constants: one fixed colour per entity (colour follows the entity,  */
/* never its rank). Every colour is also backed by a text label.       */
/* ------------------------------------------------------------------ */

type RiskLevel = Case["risk"]["level"];
type Tier = Customer["tier"];

const CARD = "rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]";

const ROUTES: ReadonlyArray<{ key: Route; label: string; color: string }> = [
  { key: "autonomous", label: "Autonomous", color: "#10b981" },
  { key: "human", label: "Human review", color: "#f59e0b" },
  { key: "manager", label: "Manager approval", color: "#a855f7" },
  { key: "blocked", label: "Blocked", color: "#ef4444" },
  { key: "denied", label: "Denied", color: "#fb7185" },
];

const STATUSES: ReadonlyArray<{ key: CaseStatus; label: string; color: string }> = [
  { key: "executed", label: "Executed", color: "#10b981" },
  { key: "pending_approval", label: "Pending approval", color: "#f59e0b" },
  { key: "rejected", label: "Rejected", color: "#64748b" },
  { key: "denied", label: "Denied", color: "#fb7185" },
];

const RISK_LEVELS: ReadonlyArray<{ key: RiskLevel; label: string; color: string }> = [
  { key: "LOW", label: "Low", color: "#10b981" },
  { key: "MEDIUM", label: "Medium", color: "#f59e0b" },
  { key: "HIGH", label: "High", color: "#ef4444" },
];

/** Ordered categories: a single-hue ramp, light to dark. */
const TIERS: ReadonlyArray<{ key: Tier; label: string; color: string }> = [
  { key: "Standard", label: "Standard", color: "#c7d2fe" },
  { key: "Silver", label: "Silver", color: "#a5b4fc" },
  { key: "Gold", label: "Gold", color: "#6366f1" },
  { key: "Platinum", label: "Platinum", color: "#4338ca" },
];

const ACTIONS: ReadonlyArray<{ key: ResolutionAction; label: string }> = [
  { key: "refund", label: "Refund" },
  { key: "replace", label: "Replacement" },
  { key: "store_credit", label: "Store credit" },
];

const SERIES_PRIMARY = "#6366f1";
const SERIES_NEUTRAL = "#cbd5e1";

const SCOPE_STYLE: Record<ToolScope, string> = {
  read: "bg-slate-50 text-slate-500",
  write: "bg-amber-50 text-amber-700",
  irreversible: "bg-red-50 text-red-600",
  sandbox: "bg-violet-50 text-violet-600",
  model: "bg-indigo-50 text-indigo-600",
};

/* ------------------------------------------------------------------ */
/* Stats: everything below is derived from the `cases` prop only.      */
/* ------------------------------------------------------------------ */

interface EngineTally { python: number; typescript: number }
interface ToolRow { tool: string; scope: ToolScope; calls: number; totalMs: number; denied: number }

interface Stats {
  total: number;
  byRoute: Record<Route, number>;
  byStatus: Record<CaseStatus, number>;
  byRisk: Record<RiskLevel, number>;
  byTier: Record<Tier, number>;
  byAction: Record<ResolutionAction, { value: number; count: number }>;
  resolvedValue: number;
  avgRisk: number;
  policyEngine: EngineTally;
  riskEngine: EngineTally;
  tools: ToolRow[];
  toolCallCount: number;
  toolDenied: number;
}

function bump<K extends string>(rec: Record<K, number>, key: K | undefined) {
  if (key !== undefined && key in rec) rec[key] += 1;
}

function tally(t: EngineTally, engine: "python" | "typescript" | undefined) {
  if (engine === "python") t.python += 1;
  else if (engine === "typescript") t.typescript += 1;
}

function computeStats(cases: Case[]): Stats {
  const byRoute: Record<Route, number> = { autonomous: 0, human: 0, manager: 0, blocked: 0, denied: 0 };
  const byStatus: Record<CaseStatus, number> = { pending_approval: 0, executed: 0, rejected: 0, denied: 0 };
  const byRisk: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  const byTier: Record<Tier, number> = { Standard: 0, Silver: 0, Gold: 0, Platinum: 0 };
  const byAction: Record<ResolutionAction, { value: number; count: number }> = {
    refund: { value: 0, count: 0 },
    replace: { value: 0, count: 0 },
    store_credit: { value: 0, count: 0 },
  };
  const policyEngine: EngineTally = { python: 0, typescript: 0 };
  const riskEngine: EngineTally = { python: 0, typescript: 0 };
  const toolMap = new Map<string, ToolRow>();
  let resolvedValue = 0;
  let scoreSum = 0;
  let scoreN = 0;
  let toolCallCount = 0;
  let toolDenied = 0;

  for (const c of cases) {
    bump(byRoute, c.decision?.route);
    bump(byStatus, c.status);
    bump(byRisk, c.risk?.level);
    bump(byTier, c.customer?.tier);

    if (c.status === "executed" && c.resolution && Number.isFinite(c.resolution.amount)) {
      resolvedValue += c.resolution.amount;
      const bucket = byAction[c.resolution.action];
      if (bucket) {
        bucket.value += c.resolution.amount;
        bucket.count += 1;
      }
    }

    if (c.risk && Number.isFinite(c.risk.score)) {
      scoreSum += c.risk.score;
      scoreN += 1;
    }
    tally(policyEngine, c.policy?.engine);
    tally(riskEngine, c.risk?.engine);

    for (const t of c.toolCalls ?? []) {
      const row = toolMap.get(t.tool) ?? { tool: t.tool, scope: t.scope, calls: 0, totalMs: 0, denied: 0 };
      row.calls += 1;
      row.totalMs += Number.isFinite(t.ms) ? t.ms : 0;
      if (t.status === "denied") row.denied += 1;
      toolMap.set(t.tool, row);
      toolCallCount += 1;
      if (t.status === "denied") toolDenied += 1;
    }
  }

  const tools = [...toolMap.values()].sort((a, b) => b.calls - a.calls || a.tool.localeCompare(b.tool));

  return {
    total: cases.length,
    byRoute,
    byStatus,
    byRisk,
    byTier,
    byAction,
    resolvedValue,
    avgRisk: scoreN > 0 ? scoreSum / scoreN : 0,
    policyEngine,
    riskEngine,
    tools,
    toolCallCount,
    toolDenied,
  };
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);

/** Flips to true shortly after mount so bars/columns grow from zero instead of appearing fully drawn. */
function useGrown() {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setGrown(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);
  return grown;
}

const stagger = (i: number) => ({ "--i": Math.min(i, 10) }) as React.CSSProperties;

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function Card({ title, subtitle, index, className = "", children }: {
  title: string;
  subtitle: string;
  index: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${CARD} fade-up ${className}`} style={stagger(index)}>
      <div className="mb-3.5">
        <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />;
}

interface BarRowData { key: string; label: string; value: number; display: string; note?: string; color: string; title: string }

/** Horizontal bars: label | bar | value. Fixed column widths so every bar in a chart shares one baseline and scale. */
function BarList({ label, rows, grown, valueWidth = 76, showDots = true }: {
  label: string;
  rows: BarRowData[];
  grown: boolean;
  valueWidth?: number;
  showDots?: boolean;
}) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <ul aria-label={label} className="space-y-3">
      {rows.map(r => (
        <li
          key={r.key}
          title={r.title}
          className="grid items-center gap-3 text-[12px]"
          style={{ gridTemplateColumns: `112px minmax(0,1fr) ${valueWidth}px` }}
        >
          <span className={`flex min-w-0 items-center gap-1.5 truncate ${r.value > 0 ? "text-slate-600" : "text-slate-400"}`}>
            {showDots && <Dot color={r.color} />}
            <span className="truncate">{r.label}</span>
          </span>
          <span className="h-2.5 overflow-hidden rounded-[4px] bg-slate-100/80" aria-hidden="true">
            <span
              className="block h-full rounded-r-[4px] transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: grown ? `${(r.value / max) * 100}%` : "0%", backgroundColor: r.color }}
            />
          </span>
          <span className={`text-right tabular-nums ${r.value > 0 ? "font-semibold text-slate-900" : "text-slate-400"}`}>
            {r.display}
            {r.note && <span className="ml-1 font-normal text-slate-400">{r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface LegendRowData { key: string; label: string; value: number; color: string }

/** Legend that doubles as the data table: swatch, name, count, share. */
function LegendList({ label, rows, total }: { label: string; rows: LegendRowData[]; total: number }) {
  return (
    <ul aria-label={label} className="min-w-0 flex-1 space-y-1.5">
      {rows.map(r => (
        <li key={r.key} className="flex items-center gap-2 text-[12px]" title={`${r.label}: ${plural(r.value, "case")} (${pct(r.value, total)}%)`}>
          <Dot color={r.color} />
          <span className={`min-w-0 flex-1 truncate ${r.value > 0 ? "text-slate-600" : "text-slate-400"}`}>{r.label}</span>
          <span className={`w-8 text-right tabular-nums ${r.value > 0 ? "font-semibold text-slate-900" : "text-slate-400"}`}>{r.value}</span>
          <span className="w-10 text-right tabular-nums text-slate-400">{pct(r.value, total)}%</span>
        </li>
      ))}
    </ul>
  );
}

/** Part-to-whole ring with the total in the middle. Segments are separated by a 2px gap, not a stroke. */
function Donut({ rows, total, grown, label }: { rows: LegendRowData[]; total: number; grown: boolean; label: string }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const GAP = 2;
  const active = rows.filter(r => r.value > 0);
  const segments = active.map((r, i) => {
    const before = active.slice(0, i).reduce((sum, s) => sum + s.value, 0);
    const full = (r.value / total) * C;
    return { ...r, start: (before / total) * C, len: active.length === 1 ? full : Math.max(full - GAP, 0.5) };
  });
  return (
    <div className="relative h-[116px] w-[116px] shrink-0" role="img" aria-label={label}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={R} fill="none" strokeWidth="14" className="stroke-slate-100" />
        {segments.map(s => (
          <circle
            key={s.key}
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth="14"
            strokeDasharray={`${grown ? s.len : 0} ${C}`}
            strokeDashoffset={-s.start}
            className="transition-[stroke-dasharray] duration-500 ease-out motion-reduce:transition-none"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-bold leading-none tabular-nums text-slate-900">{total}</span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">{total === 1 ? "case" : "cases"}</span>
      </div>
    </div>
  );
}

/** One 100% stacked bar. Zero segments are omitted; a 2px surface gap separates the rest. */
function StackBar({ rows, grown, label }: { rows: LegendRowData[]; grown: boolean; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex h-3 gap-[2px]">
      {rows.filter(r => r.value > 0).map(r => (
        <span
          key={r.key}
          className="h-full min-w-[4px] rounded-[3px] transition-[flex-grow] duration-500 ease-out motion-reduce:transition-none"
          style={{ flexGrow: grown ? r.value : 0, flexBasis: 0, backgroundColor: r.color }}
        />
      ))}
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[12px] text-slate-400">{children}</p>;
}

/* ------------------------------------------------------------------ */
/* KPI row                                                             */
/* ------------------------------------------------------------------ */

interface Kpi { label: string; value: string; caption: string; Icon: typeof Activity; tone: string }

function KpiCard({ kpi, index }: { kpi: Kpi; index: number }) {
  const { Icon } = kpi;
  return (
    <div
      className={`${CARD} fade-up ${index === 4 ? "col-span-2 md:col-span-1" : ""}`}
      style={stagger(index)}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${kpi.tone}`}>
          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="text-[12px] font-medium text-slate-500">{kpi.label}</span>
      </div>
      <div className="mt-3 text-[28px] font-bold leading-none tabular-nums text-slate-900">{kpi.value}</div>
      <div className="mt-2 text-[11px] text-slate-400">{kpi.caption}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

function Dashboard({ stats }: { stats: Stats }) {
  const grown = useGrown();
  const { total } = stats;

  const executed = stats.byStatus.executed;
  const pending = stats.byStatus.pending_approval;
  const autonomous = stats.byRoute.autonomous;
  const humanReviewed = stats.byRoute.human + stats.byRoute.manager + stats.byRoute.blocked;
  const stopped = stats.byRoute.blocked + stats.byRoute.denied;

  const kpis: Kpi[] = [
    {
      label: "Cases handled",
      value: total.toLocaleString("en-US"),
      caption: `${executed} executed · ${pending} pending`,
      Icon: Activity,
      tone: "bg-indigo-50 text-indigo-500",
    },
    {
      label: "Autonomous rate",
      value: `${pct(autonomous, total)}%`,
      caption: `${autonomous} of ${plural(total, "case")} needed no human`,
      Icon: ShieldCheck,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Human-reviewed",
      value: humanReviewed.toLocaleString("en-US"),
      caption: `${pending} still awaiting a decision`,
      Icon: Users,
      tone: "bg-amber-50 text-amber-600",
    },
    {
      label: "Value resolved",
      value: usd(stats.resolvedValue),
      caption: `across ${plural(executed, "executed case")}`,
      Icon: DollarSign,
      tone: "bg-violet-50 text-violet-500",
    },
    {
      label: "Blocked / denied",
      value: stopped.toLocaleString("en-US"),
      caption: `${pct(stopped, total)}% stopped by policy or risk checks`,
      Icon: Ban,
      tone: "bg-red-50 text-red-500",
    },
  ];

  // Approval route distribution
  const routeRows: BarRowData[] = ROUTES.map(r => ({
    key: r.key,
    label: r.label,
    value: stats.byRoute[r.key],
    display: String(stats.byRoute[r.key]),
    note: `· ${pct(stats.byRoute[r.key], total)}%`,
    color: r.color,
    title: `${r.label}: ${plural(stats.byRoute[r.key], "case")} (${pct(stats.byRoute[r.key], total)}%)`,
  }));
  const routeSummary = ROUTES.map(r => `${r.label} ${stats.byRoute[r.key]}`).join(", ");

  // Outcomes by status
  const statusRows: LegendRowData[] = STATUSES.map(s => ({ key: s.key, label: s.label, value: stats.byStatus[s.key], color: s.color }));
  const statusSummary = statusRows.map(r => `${r.label} ${r.value}`).join(", ");

  // Resolved value by resolution type (one measure, one series colour)
  const actionRows: BarRowData[] = ACTIONS.map(a => {
    const b = stats.byAction[a.key];
    return {
      key: a.key,
      label: a.label,
      value: b.value,
      display: usd(b.value),
      note: undefined,
      color: SERIES_PRIMARY,
      title: `${a.label}: ${usd(b.value)} across ${plural(b.count, "executed case")}`,
    };
  });

  // Risk levels
  const riskRows: LegendRowData[] = RISK_LEVELS.map(r => ({ key: r.key, label: r.label, value: stats.byRisk[r.key], color: r.color }));
  const riskSummary = riskRows.map(r => `${r.label} ${r.value}`).join(", ");

  // Customer tier (ordered categories, ordinal ramp)
  const tierMax = Math.max(1, ...TIERS.map(t => stats.byTier[t.key]));
  const tierSummary = TIERS.map(t => `${t.label} ${stats.byTier[t.key]}`).join(", ");
  const BAR_MAX_PX = 96;

  // Engines
  const py = stats.policyEngine.python + stats.riskEngine.python;
  const ts = stats.policyEngine.typescript + stats.riskEngine.typescript;
  const engineTotal = py + ts;
  const pyPct = pct(py, engineTotal);
  const tsPct = engineTotal > 0 ? 100 - pyPct : 0;
  const engineRows: LegendRowData[] = [
    { key: "python", label: "Python service", value: py, color: SERIES_PRIMARY },
    { key: "typescript", label: "TypeScript fallback", value: ts, color: SERIES_NEUTRAL },
  ];

  // Tools
  const TOOL_LIMIT = 10;
  const shownTools = stats.tools.slice(0, TOOL_LIMIT);
  const maxAvg = Math.max(1, ...shownTools.map(t => t.totalMs / t.calls));

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k, i) => (
          <KpiCard key={k.label} kpi={k} index={i + 1} />
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Approval route" subtitle="Where the decision layer sent each case" index={6}>
          <div role="group" aria-label={`Approval route distribution: ${routeSummary}`}>
            <BarList label="Cases per approval route" rows={routeRows} grown={grown} />
          </div>
        </Card>

        <Card title="Outcomes" subtitle="Where every case ended up" index={7}>
          <div className="flex items-center gap-5">
            <Donut rows={statusRows} total={total} grown={grown} label={`Outcomes by status: ${statusSummary}`} />
            <LegendList label="Cases per outcome" rows={statusRows} total={total} />
          </div>
        </Card>

        <Card title="Value resolved" subtitle="Dollars paid out on executed cases, by resolution type" index={8}>
          {stats.resolvedValue > 0 ? (
            <div role="group" aria-label={`Resolved value by type: ${actionRows.map(r => `${r.label} ${r.display}`).join(", ")}`}>
              <BarList label="Resolved value per resolution type" rows={actionRows} grown={grown} valueWidth={92} showDots={false} />
              <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
                <span>Total across {plural(executed, "executed case")}</span>
                <span className="text-[12px] font-semibold tabular-nums text-slate-900">{usd(stats.resolvedValue)}</span>
              </div>
            </div>
          ) : (
            <EmptyNote>No executed resolutions yet.</EmptyNote>
          )}
        </Card>

        <Card title="Risk level" subtitle="Assessed by the risk agent before any action" index={9}>
          <div className="space-y-3.5">
            <StackBar rows={riskRows} grown={grown} label={`Risk level distribution: ${riskSummary}`} />
            <LegendList label="Cases per risk level" rows={riskRows} total={total} />
            <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
              <span>Average risk score</span>
              <span className="text-[12px] font-semibold tabular-nums text-slate-900">{stats.avgRisk.toFixed(1)}</span>
            </div>
          </div>
        </Card>

        <Card title="Customer tier" subtitle="Who the cases are coming from" index={10}>
          <div role="img" aria-label={`Cases by customer tier: ${tierSummary}`}>
            <div className="flex h-[124px] items-end justify-around gap-3 border-b border-slate-200">
              {TIERS.map(t => {
                const n = stats.byTier[t.key];
                const h = n > 0 ? Math.max(4, Math.round((n / tierMax) * BAR_MAX_PX)) : 0;
                return (
                  <div key={t.key} className="flex flex-1 flex-col items-center gap-1" title={`${t.label}: ${plural(n, "case")} (${pct(n, total)}%)`}>
                    <span className={`text-[12px] tabular-nums ${n > 0 ? "font-semibold text-slate-900" : "text-slate-400"}`}>{n}</span>
                    <div
                      className="w-6 rounded-t-[4px] transition-[height] duration-500 ease-out motion-reduce:transition-none"
                      style={{ height: grown ? h : 0, backgroundColor: t.color }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex justify-around gap-3">
              {TIERS.map(t => (
                <div key={t.key} className="flex flex-1 flex-col items-center">
                  <span className="text-[11px] font-medium text-slate-600">{t.label}</span>
                  <span className="text-[10px] tabular-nums text-slate-400">{pct(stats.byTier[t.key], total)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Decision engines" subtitle="Which implementation ran the policy and risk checks" index={11}>
          {engineTotal > 0 ? (
            <div className="space-y-3.5">
              <div>
                <div className="mb-2 text-[13px] font-semibold tabular-nums text-slate-900">
                  Python {pyPct}% <span className="font-normal text-slate-300">·</span> TypeScript {tsPct}%
                </div>
                <StackBar rows={engineRows} grown={grown} label={`Policy and risk engine: ${pyPct}% Python, ${tsPct}% TypeScript`} />
              </div>
              <ul aria-label="Engine per check" className="space-y-1.5 text-[12px]">
                {engineRows.map(r => (
                  <li key={r.key} className="flex items-center gap-2">
                    <Dot color={r.color} />
                    <span className="flex-1 text-slate-600">{r.label}</span>
                    <span className="tabular-nums font-semibold text-slate-900">{r.value}</span>
                    <span className="w-10 text-right tabular-nums text-slate-400">{pct(r.value, engineTotal)}%</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-1 border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Policy checks</span>
                  <span className="tabular-nums">{stats.policyEngine.python} Python · {stats.policyEngine.typescript} TypeScript</span>
                </div>
                <div className="flex justify-between">
                  <span>Risk checks</span>
                  <span className="tabular-nums">{stats.riskEngine.python} Python · {stats.riskEngine.typescript} TypeScript</span>
                </div>
              </div>
            </div>
          ) : (
            <EmptyNote>No engine data recorded on these cases.</EmptyNote>
          )}
        </Card>

        <Card
          title="Tool performance"
          subtitle={
            stats.toolCallCount > 0
              ? `${plural(stats.toolCallCount, "call")} across ${plural(stats.tools.length, "tool")} · ${stats.toolDenied} denied by permission checks`
              : "Latency and denials for every tool the agents call"
          }
          index={12}
          className="md:col-span-2 xl:col-span-3"
        >
          {shownTools.length === 0 ? (
            <EmptyNote>
              <Wrench className="mx-auto mb-1.5 h-5 w-5 text-slate-300" strokeWidth={1.6} aria-hidden="true" />
              No tool calls recorded yet.
            </EmptyNote>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[12px]">
                <caption className="sr-only">Per-tool call count, average latency in milliseconds and denied calls</caption>
                <thead>
                  <tr className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400">
                    <th scope="col" className="pb-2 pr-3 font-medium">Tool</th>
                    <th scope="col" className="pb-2 pr-3 font-medium">Scope</th>
                    <th scope="col" className="pb-2 pr-3 text-right font-medium">Calls</th>
                    <th scope="col" className="pb-2 pr-3 font-medium">Avg latency</th>
                    <th scope="col" className="pb-2 text-right font-medium">Denied</th>
                  </tr>
                </thead>
                <tbody>
                  {shownTools.map(t => {
                    const avg = t.totalMs / t.calls;
                    return (
                      <tr key={t.tool} className="border-t border-slate-100">
                        <th scope="row" className="py-2 pr-3 font-medium text-slate-800">{t.tool}</th>
                        <td className="py-2 pr-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${SCOPE_STYLE[t.scope] ?? SCOPE_STYLE.read}`}>{t.scope}</span>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{t.calls}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-3">
                            <span className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                              <span
                                className="block h-full rounded-r-[4px] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                                style={{ width: grown ? `${Math.max(2, (avg / maxAvg) * 100)}%` : "0%", backgroundColor: SERIES_PRIMARY }}
                              />
                            </span>
                            <span className="w-14 text-right tabular-nums text-slate-700">{fmtMs(avg)}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          {t.denied > 0 ? (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-red-600">{t.denied}</span>
                          ) : (
                            <span className="tabular-nums text-slate-300">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {stats.tools.length > TOOL_LIMIT && (
                <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                  +{stats.tools.length - TOOL_LIMIT} more {stats.tools.length - TOOL_LIMIT === 1 ? "tool" : "tools"} with fewer calls
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Loading + empty states                                              */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading analytics" className="animate-pulse">
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className={`${CARD} ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}>
            <div className="h-7 w-24 rounded-lg bg-slate-100" />
            <div className="mt-3 h-7 w-20 rounded-md bg-slate-100" />
            <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div key={i} className={`${CARD} h-[188px]`}>
            <div className="h-3.5 w-28 rounded bg-slate-100" />
            <div className="mt-2 h-3 w-44 rounded bg-slate-100" />
            <div className="mt-6 space-y-3">
              <div className="h-2.5 rounded bg-slate-100" />
              <div className="h-2.5 w-4/5 rounded bg-slate-100" />
              <div className="h-2.5 w-3/5 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/** Analytics: how the agents are handling cases, computed only from the cases passed in. */
export function AnalyticsView({ cases, loaded }: { cases: Case[]; loaded: boolean }) {
  const stats = useMemo(() => computeStats(cases), [cases]);
  const hasData = loaded && cases.length > 0;

  return (
    <div className="mx-auto max-w-[1400px] px-6 pb-6 pt-2">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-bold text-slate-900">Analytics</h2>
          <p className="text-[12px] text-slate-500">How the agents are handling cases — computed live from every case on record</p>
        </div>
        {hasData && (
          <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium tabular-nums text-slate-500">
            {plural(cases.length, "case")} analysed
          </span>
        )}
      </div>

      {!loaded ? (
        <Skeleton />
      ) : cases.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-20 text-center">
          <BarChart3 className="h-10 w-10 text-slate-300" strokeWidth={1.4} aria-hidden="true" />
          <div className="mt-3 text-[15px] font-medium text-slate-600">No cases to analyse yet</div>
          <div className="mt-1 max-w-sm text-[13px] text-slate-400">
            Ask the agent to process a refund from Home or Conversations and the routes, outcomes and tool timings will show up here.
          </div>
        </div>
      ) : (
        <Dashboard stats={stats} />
      )}
    </div>
  );
}
