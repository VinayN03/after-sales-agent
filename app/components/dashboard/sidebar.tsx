"use client";

/**
 * Left sidebar — shown by default. The small icon at the bottom hides it; when hidden, the
 * hover-reveal edge menu (edge-nav.tsx) takes over and offers a "Show sidebar" button.
 */
import { PanelLeftClose } from "lucide-react";
import { NAV_ITEMS, type View } from "./edge-nav";

export function Sidebar({
  view,
  chatOpen,
  knowledgeOpen,
  pending,
  onNavigate,
  onToggleKnowledge,
  onHide,
}: {
  view: View;
  chatOpen: boolean;
  knowledgeOpen: boolean;
  pending: number;
  onNavigate: (v: View) => void;
  onToggleKnowledge: () => void;
  onHide: () => void;
}) {
  return (
    <nav aria-label="Main navigation" className="flex w-[76px] flex-shrink-0 flex-col items-center border-r border-slate-100 bg-white py-3">
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto px-1.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = id === "knowledge" ? knowledgeOpen : id === "conversations" ? chatOpen : id === view;
          return (
            <button
              key={id}
              onClick={() => (id === "knowledge" ? onToggleKnowledge() : onNavigate(id))}
              title={label}
              aria-current={active ? "page" : undefined}
              className={`press flex w-full flex-col items-center gap-0.5 rounded-lg px-0.5 py-2 text-[10px] font-medium ${
                active ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <span className="relative">
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                {id === "approvals" && pending > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {pending}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onHide}
        aria-label="Hide sidebar"
        title="Hide sidebar"
        className="press mt-2 rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      >
        <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </button>
    </nav>
  );
}
