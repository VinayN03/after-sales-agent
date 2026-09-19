"use client";

/**
 * Edge navigation — replaces the sidebar. Nothing is shown except a tiny three-dot handle on the
 * left edge, vertically centred. Hover anywhere along the left edge (or tap the dots on touch
 * screens) and a small column of icons fades in, also centred; everything above and below stays empty.
 */
import { useState } from "react";
import { BarChart3, BookOpen, Home, MessageSquare, Package, PanelLeftOpen, Settings, UserCheck, Users, type LucideIcon } from "lucide-react";

export type View = "home" | "conversations" | "approvals" | "customers" | "orders" | "analytics" | "settings";

export const NAV_ITEMS: Array<{ id: View | "knowledge"; label: string; icon: LucideIcon }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "conversations", label: "Conversations", icon: MessageSquare },
  { id: "approvals", label: "Approvals", icon: UserCheck },
  { id: "customers", label: "Customers", icon: Users },
  { id: "orders", label: "Orders", icon: Package },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function EdgeNav({
  view,
  knowledgeOpen,
  chatOpen = false,
  onNavigate,
  onToggleKnowledge,
  onShowSidebar,
}: {
  view: View;
  knowledgeOpen: boolean;
  chatOpen?: boolean;
  onShowSidebar?: () => void;
  onNavigate: (v: View) => void;
  onToggleKnowledge: () => void;
}) {
  // Touch devices can't hover, so the dots also toggle the rail.
  const [pinned, setPinned] = useState(false);

  return (
    // Full-height hot strip along the left edge; the rail is a child, so hovering it keeps everything open.
    <nav aria-label="Main navigation" className="group fixed inset-y-0 left-0 z-40 w-5">
      <button
        onClick={() => setPinned(v => !v)}
        aria-label="Open navigation"
        aria-expanded={pinned}
        className={`absolute left-1 top-1/2 -translate-y-1/2 rounded-full px-1.5 py-2 transition-opacity duration-150 ease-out group-hover:opacity-0 group-focus-within:opacity-0 ${pinned ? "opacity-0" : "opacity-100"}`}
      >
        <span className="flex flex-col gap-[3px]">
          {[0, 1, 2].map(i => (
            <span key={i} className="h-[3px] w-[3px] rounded-full bg-slate-400/70" />
          ))}
        </span>
      </button>

      <div
        className={`absolute left-2 top-1/2 -translate-y-1/2 rounded-2xl border border-slate-200/80 bg-white/95 p-1 shadow-[0_8px_30px_rgba(15,23,42,0.12)] backdrop-blur transition-[opacity,transform] duration-200 ease-out
          group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100
          group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100
          ${pinned ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none -translate-x-2 opacity-0"}`}
      >
        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = id === "knowledge" ? knowledgeOpen : id === "conversations" ? chatOpen : id === view;
            return (
              <button
                key={id}
                onClick={() => {
                  if (id === "knowledge") onToggleKnowledge();
                  else onNavigate(id);
                  setPinned(false);
                }}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`press group/item relative flex h-8 w-8 items-center justify-center rounded-xl ${
                  active ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                <span className="pointer-events-none absolute left-full ml-2.5 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover/item:opacity-100">
                  {label}
                </span>
              </button>
            );
          })}
          {onShowSidebar && (
            <>
              <div className="mx-1.5 my-1 h-px bg-slate-200" />
              <button
                onClick={() => {
                  onShowSidebar();
                  setPinned(false);
                }}
                aria-label="Show sidebar"
                className="press group/item relative flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <PanelLeftOpen className="h-4 w-4" strokeWidth={1.8} />
                <span className="pointer-events-none absolute left-full ml-2.5 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover/item:opacity-100">
                  Show sidebar
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
