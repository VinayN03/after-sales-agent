"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowRight, ArrowUp, BookOpen, CheckCircle2, ChevronDown, Clock, Diamond, MessageSquare,
  Mic, MoreHorizontal, Paperclip, Search, Send, ShieldCheck, Sparkles, Undo2, UserCheck, Users, Zap,
  type LucideIcon,
} from "lucide-react";
import type { AgentEvent, Case } from "../../../agents/_agents/types";
import { latestPerAgent } from "../agent-timeline";
import { ACTIVITY_HEADING, caseStatus, fmtDate, fmtTime, initials, money, shortOrder, truncate } from "./helpers";
import { Sparkline } from "./sparkline";

// Simulated history for the KPI cards — live cases are added on top of these.
const BASELINE = { open: 22, resolved: 124 };

const CHIPS: Array<{ label: string; icon: LucideIcon; ask?: string }> = [
  { label: "Refund a damaged order", icon: Undo2, ask: "My headphones from order ORD-20260914-101 arrived damaged, I'd like a refund" },
  { label: "Find an order", icon: Search, ask: "I'd like to look up my orders" },
  { label: "Check refund eligibility", icon: ShieldCheck, ask: "I changed my mind about the lamp in order ORD-20260720-105, can I get a refund?" },
  { label: "Show pending approvals", icon: UserCheck },
];

const COLS = "grid-cols-[1.6fr_1.5fr_0.8fr_0.7fr_1.1fr_1.05fr_20px]";

interface Props {
  cases: Case[];
  loaded: boolean;
  onAsk: (text: string) => void;
  onOpenApprovals: () => void;
  onOpenKnowledge: () => void;
}

export function HomeView({ cases, loaded, onAsk, onOpenApprovals, onOpenKnowledge }: Props) {
  const [text, setText] = useState("");
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" }));
  }, []);

  const pending = useMemo(() => cases.filter(c => c.status === "pending_approval"), [cases]);
  const resolved = useMemo(() => cases.filter(c => c.status === "executed"), [cases]);
  const latest = cases[0];
  const activity = useMemo(
    () => (latest ? latestPerAgent(latest.events).filter(e => e.agent !== "orchestrator").slice(-7) : []),
    [latest],
  );

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    onAsk(v);
    setText("");
  };

  return (
    <div className="mx-auto flex min-h-full max-w-[1400px] flex-col px-6 pb-4">
      {/* Hero */}
      <section className="pb-3 pt-1 text-center">
        <h2 className="text-[26px] font-bold tracking-tight text-slate-900">Resolve customer issues.</h2>
        <p className="mt-0.5 text-[13px] text-slate-500">AI-powered support that takes action, not just answers.</p>

        <div className="mx-auto mt-3 flex max-w-[720px] items-center gap-2.5 rounded-full border border-slate-100 bg-white py-1.5 pl-3.5 pr-1.5 shadow-[0_4px_24px_rgba(79,70,229,0.08)]">
          <Sparkles className="h-5 w-5 flex-shrink-0 text-indigo-500" strokeWidth={1.8} />
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="How can I help a customer today?"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-slate-800 outline-none placeholder:text-slate-400"
          />
          <Paperclip className="hidden h-4 w-4 flex-shrink-0 text-slate-300 sm:block" />
          <Mic className="hidden h-4 w-4 flex-shrink-0 text-slate-300 sm:block" />
          <button
            onClick={submit}
            disabled={!text.trim()}
            aria-label="Send"
            className="press flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md disabled:cursor-default"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {CHIPS.map(({ label, icon: Icon, ask }) => (
            <button
              key={label}
              onClick={() => (ask ? onAsk(ask) : onOpenApprovals())}
              className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 shadow-sm press hover:border-indigo-200 hover:text-indigo-600"
            >
              <Icon className="h-3.5 w-3.5 text-indigo-500" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Today */}
      <section>
        <div className="mb-2 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-900">Today</h3>
            <p className="truncate text-[11.5px] text-slate-500">
              Here&apos;s what&apos;s happening with your after-sales support.
              <span className="ml-2 hidden text-slate-400 lg:inline">Demo baseline metrics — live cases update open, pending and resolved.</span>
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2.5 text-[12px] text-slate-400">
            <span className="hidden sm:inline">{today}</span>
            <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700">
              Last 24 hours <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={MessageSquare} tint="bg-indigo-50 text-indigo-500" i={0} label="Open conversations" value={String(BASELINE.open + pending.length)}
            delta="20%" up={false} good stroke="#6366f1" points={[6, 8, 5, 9, 7, 8, 6, 7, 5, 6]} sub="vs. yesterday" />
          <Kpi icon={Users} tint="bg-orange-50 text-orange-500" i={1} label="Pending approvals" value={String(pending.length)}
            delta="50%" up good={false} stroke="#f59e0b" points={[5, 7, 6, 8, 6, 9, 7, 8, 6, 7]} sub="vs. yesterday" onClick={onOpenApprovals} />
          <Kpi icon={CheckCircle2} tint="bg-emerald-50 text-emerald-500" i={2} label="Issues resolved" value={String(BASELINE.resolved + resolved.length)}
            delta="18%" up good stroke="#10b981" points={[3, 4, 4, 5, 6, 6, 7, 8, 8, 10]} sub="vs. yesterday" />
          <Kpi icon={Clock} tint="bg-indigo-50 text-indigo-500" i={3} label="Avg. resolution time" value="4m 32s"
            delta="28%" up={false} good stroke="#6366f1" points={[6, 7, 6, 8, 7, 6, 7, 6, 7, 6]} sub="vs. last week" />
        </div>
      </section>

      {/* Cases · Activity · Quick actions — fills the remaining height; each panel scrolls inside itself */}
      <section className="mt-3 grid flex-1 grid-cols-1 gap-3 xl:min-h-[230px] xl:grid-cols-[minmax(0,1fr)_260px_230px] xl:grid-rows-[minmax(0,1fr)]">
        <Card i={3}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <MessageSquare className="mt-0.5 h-4 w-4 text-slate-700" strokeWidth={1.8} />
              <div>
                <h3 className="text-[14px] font-semibold text-slate-900">Active cases</h3>
                <p className="text-[11.5px] text-slate-500">Current customer issues being handled by the agent.</p>
              </div>
            </div>
            <button onClick={onOpenApprovals} className="flex items-center gap-1 text-[12px] font-medium text-indigo-600 hover:text-indigo-700">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2 min-h-0 flex-1 overflow-auto">
            <div className="min-w-[580px]">
              <div className={`sticky top-0 z-10 grid ${COLS} gap-3 border-b border-slate-100 bg-white pb-1.5 text-[11px] font-medium text-slate-400`}>
                <span>Customer</span><span>Issue</span><span>Order</span><span>Amount</span><span>Status</span><span>AI Confidence</span><span />
              </div>
              {cases.slice(0, 8).map((c, i) => <CaseRow key={c.caseId} c={c} i={i} onOpen={onOpenApprovals} />)}
              {loaded && cases.length === 0 && (
                <div className="py-8 text-center text-[12px] text-slate-400">
                  No active cases yet. Ask the agent to handle a refund to see it work.
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card i={4}>
          <div className="flex items-start gap-2.5">
            <Zap className="mt-0.5 h-4 w-4 text-slate-700" strokeWidth={1.8} />
            <div>
              <h3 className="text-[14px] font-semibold text-slate-900">Agent activity</h3>
              <p className="text-[11.5px] text-slate-500">Live progress of the current conversation.</p>
            </div>
          </div>
          <ol className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            {activity.map((e, i) => <ActivityRow key={e.agent} e={e} i={i} last={i === activity.length - 1} />)}
          </ol>
          {loaded && activity.length === 0 && (
            <div className="py-6 text-center text-[12px] text-slate-400">Agents will appear here as they work on a case.</div>
          )}
        </Card>

        <Card i={5}>
          <div className="flex items-center gap-2">
            <Diamond className="h-4 w-4 text-slate-700" strokeWidth={1.8} />
            <h3 className="text-[14px] font-semibold text-slate-900">Quick actions</h3>
          </div>
          <div className="mt-2.5 min-h-0 flex-1 space-y-2 overflow-y-auto">
            <QuickAction icon={MessageSquare} tint="text-indigo-500 bg-indigo-50" title="New conversation" sub="Start with a customer" onClick={() => onAsk("")} />
            <QuickAction icon={Search} tint="text-indigo-500 bg-indigo-50" title="Search order" sub="Find order details" onClick={() => onAsk("I'd like to look up my orders")} />
            <QuickAction icon={Users} tint="text-orange-500 bg-orange-50" title="Review approvals" sub={`${pending.length} pending`} onClick={onOpenApprovals} />
            <QuickAction icon={BookOpen} tint="text-indigo-500 bg-indigo-50" title="Knowledge base" sub="Search policies" onClick={onOpenKnowledge} />
            <div className="flex items-center gap-2.5 rounded-xl bg-indigo-50/70 p-2.5">
              <Sparkles className="h-5 w-5 flex-shrink-0 text-indigo-500" strokeWidth={1.6} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-slate-800">AI agents working for you</div>
                <div className="text-[11px] leading-snug text-slate-500">Customer lookup, policy analysis, fraud detection and more.</div>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

function Card({ children, i = 0 }: { children: React.ReactNode; i?: number }) {
  return (
    <div style={{ "--i": i } as React.CSSProperties} className="fade-up flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
      {children}
    </div>
  );
}

function Kpi({
  icon: Icon, tint, label, value, delta, up, good, stroke, points, sub, onClick, i,
}: {
  i: number; icon: LucideIcon; tint: string; label: string; value: string; delta: string; up: boolean; good: boolean;
  stroke: string; points: number[]; sub: string; onClick?: () => void;
}) {
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <div
      onClick={onClick}
      style={{ "--i": i } as React.CSSProperties}
      className={`fade-up relative flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(16,24,40,0.04)] ${onClick ? "press cursor-pointer hover:shadow-md" : ""}`}
    >
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="whitespace-nowrap text-[12px] text-slate-600">{label}</div>
        <div className="whitespace-nowrap text-[22px] font-bold leading-tight tabular-nums text-slate-900">{value}</div>
        <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px] leading-tight">
          <span className={`flex items-center font-medium ${good ? "text-emerald-600" : "text-red-500"}`}>
            <Arrow className="h-3 w-3" />{delta}
          </span>
          <span className="text-slate-400">{sub}</span>
        </div>
      </div>
      <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 2xl:block">
        <Sparkline points={points} stroke={stroke} />
      </div>
    </div>
  );
}

function CaseRow({ c, i, onOpen }: { c: Case; i: number; onOpen: () => void }) {
  const status = caseStatus(c);
  const confidence = c.resolution?.confidence;
  return (
    <div onClick={onOpen} style={{ "--i": i } as React.CSSProperties} className={`fade-up grid cursor-pointer ${COLS} items-center gap-3 border-b border-slate-50 py-2 text-[12px] last:border-0 hover:bg-slate-50/60`}>
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-semibold text-indigo-600">{initials(c.customer.name)}</div>
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-800">{c.customer.name}</div>
          <div className="truncate text-[10px] text-slate-400">{c.customer.email}</div>
        </div>
      </div>
      <div className="line-clamp-2 leading-snug text-slate-600" title={c.userMessage}>{truncate(c.userMessage, 70)}</div>
      <div>
        <div className="font-semibold text-slate-800">{shortOrder(c.orderId)}</div>
        <div className="text-[10px] text-slate-400">{fmtDate(c.createdAt)}</div>
      </div>
      <div className="font-medium tabular-nums text-slate-700">{money(c.amount)}</div>
      <div><span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${status.cls}`}>{status.label}</span></div>
      <div className="flex items-center gap-2">
        {confidence != null ? (
          <>
            <span className="w-8 font-medium text-slate-700">{confidence}%</span>
            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${confidence >= 80 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${confidence}%` }} />
            </div>
          </>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </div>
      <MoreHorizontal className="h-4 w-4 text-slate-400" />
    </div>
  );
}

function ActivityRow({ e, i, last }: { e: AgentEvent; i: number; last: boolean }) {
  let heading = ACTIVITY_HEADING[e.agent];
  if (e.agent === "approval") {
    heading = e.status === "warn" ? "Waiting for human approval" : e.status === "blocked" ? "Approval declined" : "Approval granted";
  }
  const waiting = e.status === "warn" || e.status === "running";
  return (
    <li style={{ "--i": i } as React.CSSProperties} className="fade-up grid grid-cols-[16px_50px_minmax(0,1fr)] gap-x-2">
      <div className="flex flex-col items-center">
        {waiting ? (
          <span className="mt-0.5 h-4 w-4 rounded-full border-2 border-indigo-500 bg-white" />
        ) : e.status === "blocked" ? (
          <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">✕</span>
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 fill-emerald-500 text-white" />
        )}
        {!last && <span className="my-0.5 w-px flex-1 bg-slate-200" />}
      </div>
      <div className="pt-0.5 text-[10px] text-slate-400">{fmtTime(e.ts)}</div>
      <div className={`min-w-0 ${last ? "" : "pb-2.5"}`}>
        <div className="text-[12px] font-medium leading-tight text-slate-800">{heading}</div>
        <div className="truncate text-[11px] text-slate-500" title={e.summary}>{e.summary}</div>
      </div>
    </li>
  );
}

function QuickAction({ icon: Icon, tint, title, sub, onClick }: { icon: LucideIcon; tint: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-2 text-left press hover:border-indigo-200 hover:bg-indigo-50/30">
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold leading-tight text-slate-800">{title}</div>
        <div className="text-[11px] text-slate-500">{sub}</div>
      </div>
    </button>
  );
}
