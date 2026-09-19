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
    <header className="flex flex-shrink-0 items-center justify-between px-6 pb-1 pt-3">
      <div>
        <h1 className="text-[17px] font-semibold leading-tight text-slate-900">After-Sales Agent</h1>
        <p className="text-[12px] text-slate-500">Resolve faster. Happier customers.</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 md:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <div className="leading-tight">
            <div className="text-[12px] font-medium text-slate-800">Agent online</div>
            <div className="text-[10px] text-slate-400">Autonomous + Human approval</div>
          </div>
        </div>

        <span className="hidden h-6 w-px bg-slate-200 md:block" />

        <button
          onClick={onReset}
          disabled={resetting}
          title="Reset demo data"
          className="press flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3" />
          {resetting ? "Resetting…" : "Reset demo"}
        </button>
        <button
          onClick={onToggleLang}
          className="press rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
        >
          {langLabel}
        </button>

        <button onClick={onOpenApprovals} className="press relative rounded-full p-1.5 text-slate-500 hover:bg-white" aria-label="Pending approvals">
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
          {pending > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-[#F6F7FB]" />}
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">VK</div>
          <span className="hidden text-[12px] font-medium text-slate-800 lg:block">Vinay Kumar</span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 lg:block" />
        </div>
      </div>
    </header>
  );
}
