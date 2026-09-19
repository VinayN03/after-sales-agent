/**
 * Customer-facing view of a case — used by the embeddable widget.
 * Read-only: no approve/reject controls and none of the internal detail (risk scores, fraud flags,
 * routing rules). While the case waits for a human it polls, so the customer sees the decision
 * appear the moment a support agent or manager makes it in the operator dashboard.
 */
"use client";

import { useEffect, useState } from "react";
import type { Case } from "../../../agents/_agents/types";

const RESOLUTION_LABEL = { refund: "Refund", replace: "Replacement", store_credit: "Store credit" } as const;
const money = (n: number) => `$${n.toFixed(2)}`;

const STATUS = {
  pending_approval: { label: "In review", cls: "bg-amber-100 text-amber-700" },
  executed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Declined", cls: "bg-rose-100 text-rose-700" },
  denied: { label: "Not eligible", cls: "bg-slate-200 text-slate-700" },
} as const;

export function CustomerCaseCard({ initial, conversationId }: { initial: Case; conversationId: string }) {
  const [c, setC] = useState(initial);

  useEffect(() => {
    if (c.status !== "pending_approval") return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/cases", {
          method: "POST",
          headers: { "Content-Type": "application/json", "makers-conversation-id": conversationId },
          body: "{}",
        });
        const mine = ((await res.json()).cases as Case[] | undefined)?.find(x => x.caseId === c.caseId);
        if (mine) setC(mine);
      } catch {
        // keep showing the last known status
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [c.status, c.caseId, conversationId]);

  const status = STATUS[c.status];
  const failedChecks = c.policy.checks.filter(k => !k.pass).map(k => k.detail);

  return (
    <div className="fade-up overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3.5 py-2">
        <span className="text-[13px] font-medium text-gray-800">Your request</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.cls}`}>{status.label}</span>
      </div>

      <div className="space-y-1.5 px-3.5 py-3 text-[12px] text-gray-600">
        <div className="flex justify-between gap-3">
          <span className="text-gray-400">Order</span>
          <span className="text-right">{c.orderId}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-400">Item</span>
          <span className="text-right">{c.productSummary}</span>
        </div>
        {c.resolution && (
          <div className="flex justify-between gap-3">
            <span className="text-gray-400">Resolution</span>
            <span className="text-right font-medium text-gray-800">
              {RESOLUTION_LABEL[c.resolution.action]} · {money(c.resolution.amount)}
            </span>
          </div>
        )}

        <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 leading-snug text-gray-600">
          {c.status === "pending_approval" && "Our team is reviewing this. You'll see an update here as soon as it's decided."}
          {c.status === "executed" && (
            <>
              <span className="font-medium text-emerald-700">✓ Done.</span> {c.comms?.chat ?? c.execution?.[0]}
            </>
          )}
          {c.status === "rejected" && (c.comms?.chat ?? "We weren't able to approve this request.")}
          {c.status === "denied" && `This request isn't eligible: ${failedChecks.join("; ") || "it doesn't meet our return policy"}.`}
        </div>
      </div>
    </div>
  );
}
