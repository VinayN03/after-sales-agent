/**
 * Case card — the human-in-the-loop review surface for an after-sales case.
 * Shows what the agents found, the proposed resolution and who has to sign off; while the case is
 * pending it offers Approve / Reject with a role switch (support agent vs manager permission boundary).
 */
"use client";

import { useState } from "react";
import type { AgentEvent, Case, Route } from "../../../agents/_agents/types";
import { AgentTimeline } from "../agent-timeline";

const ROUTE_STYLE: Record<Route, { label: string; badge: string }> = {
  autonomous: { label: "Autonomous", badge: "bg-green-100 text-green-700" },
  human: { label: "Human approval", badge: "bg-amber-100 text-amber-700" },
  manager: { label: "Manager approval", badge: "bg-purple-100 text-purple-700" },
  blocked: { label: "Escalated · high risk", badge: "bg-red-100 text-red-700" },
  denied: { label: "Denied by policy", badge: "bg-gray-200 text-gray-700" },
};
const RISK_STYLE = { LOW: "bg-green-100 text-green-700", MEDIUM: "bg-amber-100 text-amber-700", HIGH: "bg-red-100 text-red-700" };
const ACTION_LABEL = { refund: "Refund", replace: "Replace item", store_credit: "Store credit" };
const money = (n: number) => `$${n.toFixed(2)}`;
const REVEAL_MS = 300;

type Tab = "chat" | "email" | "sms";

export function CaseCard({ initial, conversationId, onDecided }: { initial: Case; conversationId: string; onDecided?: () => void }) {
  const [c, setC] = useState(initial);
  const [role, setRole] = useState<"support" | "manager">("support");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shown, setShown] = useState<AgentEvent[]>([]);
  const [tab, setTab] = useState<Tab>("chat");
  const pending = c.status === "pending_approval";
  const route = ROUTE_STYLE[c.decision.route];

  const decide = async (decision: "approve" | "reject") => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/approve-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json", "makers-conversation-id": conversationId },
        body: JSON.stringify({ caseId: c.caseId, decision, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      const events: AgentEvent[] = data.newEvents ?? [];
      events.forEach((e, i) => setTimeout(() => setShown(prev => [...prev, e]), i * REVEAL_MS));
      setTimeout(() => { setC(data.case); setBusy(false); onDecided?.(); }, events.length * REVEAL_MS);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden max-w-md">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base">🗂️</span>
          <span className="text-sm font-medium text-gray-800">After-sales case</span>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${route.badge}`}>{route.label}</span>
      </div>

      <div className="px-4 py-3 space-y-3 text-[12px]">
        <dl className="space-y-1.5">
          <Row k="Customer" v={`${c.customer.name} · ${c.customer.tier} · ${c.customer.id}`} />
          <Row k="Order" v={`${c.orderId} · ${c.productSummary}`} />
          <Row k="Amount" v={<span className="font-semibold text-gray-800">{money(c.amount)}</span>} />
          <Row k="Policy" v={
            <span>{c.policy.eligible ? "✓ Eligible" : "✗ Not eligible"} <span className="text-gray-400">· {c.policy.citation}</span></span>
          } />
          <Row k="Fraud risk" v={
            <span className={`px-1.5 py-0.5 rounded ${RISK_STYLE[c.risk.level]}`}>{c.risk.level} ({c.risk.score}/100)</span>
          } />
          {c.resolution && (
            <Row k="Proposed" v={
              <span>
                <span className="font-medium text-gray-800">{ACTION_LABEL[c.resolution.action]} · {money(c.resolution.amount)}</span>
                <span className="text-gray-400"> · {c.resolution.confidence}% confidence</span>
                <span className="block text-gray-500 mt-0.5">{c.resolution.reason}</span>
              </span>
            } />
          )}
        </dl>

        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-gray-500 leading-snug">
          {c.decision.rationale.map((r, i) => <div key={i}>• {r}</div>)}
        </div>

        {pending && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-2">
            <div className="text-xs font-medium text-amber-800">
              🔐 Waiting for {c.decision.approver === "manager" ? "manager" : "human"} approval — nothing has been executed yet
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-amber-800">
              <span>Acting as:</span>
              {(["support", "manager"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  disabled={busy}
                  className={`px-2 py-0.5 rounded-full border ${role === r ? "bg-amber-600 text-white border-amber-600" : "bg-white border-amber-300 hover:bg-amber-100"}`}
                >
                  {r === "support" ? "Support agent" : "Manager"}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => decide("approve")}
                disabled={busy}
                className="flex-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => decide("reject")}
                disabled={busy}
                className="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
            {error && <div className="text-xs text-red-600">⛔ {error}</div>}
          </div>
        )}

        {shown.length > 0 && <AgentTimeline events={shown} title="Executing decision" />}

        {c.status === "executed" && !busy && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 space-y-1">
            <div className="font-medium text-green-700">
              ✓ {c.decidedBy ? `Approved by ${c.decidedBy === "manager" ? "manager" : "support agent"} & executed` : "Executed autonomously"}
            </div>
            {c.execution?.map((s, i) => <div key={i} className="text-green-700/80">• {s}</div>)}
          </div>
        )}
        {c.status === "rejected" && !busy && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 font-medium text-red-700">
            ✕ Rejected by {c.decidedBy === "manager" ? "manager" : "support agent"} — customer notified
          </div>
        )}

        {c.comms && !busy && (
          <div className="rounded-lg border border-gray-100 overflow-hidden">
            <div className="flex border-b border-gray-100 bg-gray-50 text-[11px]">
              {(["chat", "email", "sms"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 ${tab === t ? "bg-white text-indigo-600 font-medium" : "text-gray-500"}`}>
                  {t === "chat" ? "💬 Chat" : t === "email" ? "✉️ Email" : "📱 SMS"}
                </button>
              ))}
            </div>
            <div className="px-3 py-2 text-gray-600 whitespace-pre-wrap leading-snug">
              {tab === "chat" && c.comms.chat}
              {tab === "email" && <><div className="font-medium text-gray-700 mb-1">{c.comms.emailSubject}</div>{c.comms.emailBody}</>}
              {tab === "sms" && c.comms.sms}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 flex-shrink-0 text-gray-400">{k}</dt>
      <dd className="text-gray-700 min-w-0">{v}</dd>
    </div>
  );
}
