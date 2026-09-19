"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Inbox } from "lucide-react";
import type { Case } from "../../../agents/_agents/types";
import { CaseCard } from "../cards/case-card";
import { getConversationId } from "./helpers";

/** Manager inbox: cases waiting for a human decision, plus history of everything the agents handled. */
export function ApprovalsView({
  cases,
  loaded,
  onDecided,
  onBack,
}: {
  cases: Case[];
  loaded: boolean;
  onDecided: () => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const pending = useMemo(() => cases.filter(c => c.status === "pending_approval"), [cases]);
  const history = useMemo(() => cases.filter(c => c.status !== "pending_approval"), [cases]);
  const shown = tab === "pending" ? pending : history;
  const conversationId = getConversationId();

  return (
    <div className="mx-auto max-w-[1400px] px-8 pb-10 pt-4">
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-indigo-600">
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </button>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="text-[26px] font-bold text-slate-900">Approvals</h2>
          <p className="text-[14px] text-slate-500">
            The agents propose; a human decides. Use the role switch on a case to see the permission boundary — manager-level cases can&apos;t be approved as a support agent.
          </p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 text-[13px] font-medium">
          {([["pending", `Pending (${pending.length})`], ["history", `History (${history.length})`]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-lg px-4 py-1.5 ${tab === id ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loaded && shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-20 text-center">
          <Inbox className="h-10 w-10 text-slate-300" strokeWidth={1.4} />
          <div className="mt-3 text-[15px] font-medium text-slate-600">
            {tab === "pending" ? "Nothing waiting for approval" : "No cases handled yet"}
          </div>
          <div className="mt-1 text-[13px] text-slate-400">Ask the agent to process a refund from Home or Conversations.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {shown.map(c => (
            <CaseCard key={c.caseId} initial={c} conversationId={conversationId} onDecided={onDecided} />
          ))}
        </div>
      )}
    </div>
  );
}
