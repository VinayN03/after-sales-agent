"use client";

/**
 * Live view of the multi-agent pipeline — one row per agent, updated as its events stream in.
 */
import { useState } from "react";
import type { AgentEvent, AgentName } from "../../agents/_agents/types";

const ICON: Record<AgentName, string> = {
  orchestrator: "🧭", customer: "🧑", order: "📦", policy: "📜", risk: "🔍",
  resolution: "💰", approval: "🔐", action: "⚙️", communication: "💬", audit: "🧾",
};

/** Latest event per agent, in the order each agent first appeared. */
export function latestPerAgent(events: AgentEvent[]): AgentEvent[] {
  const order: AgentName[] = [];
  const latest = new Map<AgentName, AgentEvent>();
  for (const e of events) {
    if (!latest.has(e.agent)) order.push(e.agent);
    latest.set(e.agent, e);
  }
  return order.map(a => latest.get(a)!);
}

function StatusDot({ status }: { status: AgentEvent["status"] }) {
  if (status === "running") {
    return <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />;
  }
  const style = {
    done: "bg-green-500", warn: "bg-amber-500", blocked: "bg-red-500",
  }[status];
  const glyph = { done: "✓", warn: "!", blocked: "✕" }[status];
  return <span className={`inline-flex w-3.5 h-3.5 rounded-full ${style} text-white text-[9px] font-bold items-center justify-center`}>{glyph}</span>;
}

export function AgentTimeline({ events, title = "Agent activity" }: { events: AgentEvent[]; title?: string }) {
  const [showDetails, setShowDetails] = useState(true);
  const rows = latestPerAgent(events);
  if (rows.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/60 border-b border-indigo-100">
        <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">{title}</span>
        <button onClick={() => setShowDetails(v => !v)} className="text-[11px] text-indigo-500 hover:text-indigo-700">
          {showDetails ? "Hide details" : "Show details"}
        </button>
      </div>
      <ul className="divide-y divide-gray-50">
        {rows.map(e => (
          <li key={e.agent} className="px-3 py-2">
            <div className="flex items-start gap-2">
              <span className="text-sm leading-5">{ICON[e.agent]}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-medium text-gray-800">{e.title}</span>
                  <StatusDot status={e.status} />
                </div>
                <div className="text-[12px] text-gray-500 leading-snug">{e.summary}</div>
                {showDetails && e.details && e.status !== "running" && (
                  <ul className="mt-1 space-y-0.5">
                    {e.details.map((d, i) => (
                      <li key={i} className="text-[11px] text-gray-400 leading-snug pl-2 border-l border-gray-100">{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
