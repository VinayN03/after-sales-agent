"use client";

import { useState } from "react";
import { BarChart3, BookOpen, ChevronsLeft, Home, MessageSquare, Package, Settings, Users, type LucideIcon } from "lucide-react";

export type View = "home" | "conversations" | "approvals" | "customers" | "orders" | "analytics" | "settings";

const ITEMS: Array<{ id: View | "knowledge"; label: string; icon: LucideIcon }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "conversations", label: "Conversations", icon: MessageSquare },
  { id: "customers", label: "Customers", icon: Users },
  { id: "orders", label: "Orders", icon: Package },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  view,
  knowledgeOpen,
  onNavigate,
  onToggleKnowledge,
}: {
  view: View;
  knowledgeOpen: boolean;
  onNavigate: (v: View) => void;
  onToggleKnowledge: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav className={`flex-shrink-0 flex flex-col items-center bg-white border-r border-slate-100 py-3 transition-all ${collapsed ? "w-[52px]" : "w-[74px]"}`}>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-base font-bold text-white shadow-sm">
        A
      </div>

      <div className="flex w-full flex-1 flex-col items-center gap-0.5 px-1.5">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const active = id === "knowledge" ? knowledgeOpen : id === view;
          return (
            <button
              key={id}
              onClick={() => (id === "knowledge" ? onToggleKnowledge() : onNavigate(id))}
              title={label}
              className={`flex w-full flex-col items-center gap-0.5 rounded-lg px-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              {!collapsed && <span>{label}</span>}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setCollapsed(v => !v)}
        className="mt-2 rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronsLeft className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
      </button>
    </nav>
  );
}
