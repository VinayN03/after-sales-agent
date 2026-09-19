"use client";

import { Bell, ChevronDown, RotateCcw } from "lucide-react";

export function TopBar({
  pending,
  resetting,
  langLabel,
  onReset,
  onToggleLang,
  onOpenApprovals,
}: {
  pending: number;
  resetting: boolean;
  langLabel: string;
  onReset: () => void;
  onToggleLang: () => void;
  onOpenApprovals: () => void;
}) {
  return (
    <header className="flex flex-shrink-0 items-start justify-between px-8 pb-2 pt-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight text-slate-900">After-Sales Agent</h1>
        <p className="mt-0.5 text-[14px] text-slate-500">Resolve faster. Happier customers.</p>
      </div>

      <div className="flex items-center gap-5">
        <div className="hidden items-center gap-2.5 sm:flex">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-medium text-slate-800">Agent online</div>
            <div className="text-[11px] text-slate-400">Autonomous + Human approval</div>
          </div>
        </div>

        <span className="hidden h-8 w-px bg-slate-200 sm:block" />

        <button
          onClick={onReset}
          disabled={resetting}
          title="Reset demo data"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {resetting ? "Resetting…" : "Reset demo"}
        </button>
        <button
          onClick={onToggleLang}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
        >
          {langLabel}
        </button>

        <button onClick={onOpenApprovals} className="relative rounded-full p-2 text-slate-500 hover:bg-white" aria-label="Pending approvals">
          <Bell className="h-5 w-5" strokeWidth={1.8} />
          {pending > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#F6F7FB]" />}
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-[13px] font-semibold text-white">VK</div>
          <span className="hidden text-[14px] font-medium text-slate-800 md:block">Vinay Kumar</span>
          <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
        </div>
      </div>
    </header>
  );
}
