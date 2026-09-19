"use client";

import { useState, useEffect } from "react";
import { MessageSquare, X } from "lucide-react";
import { ChatPanel } from "./components/chat-panel";
import { EdgeNav, type View } from "./components/dashboard/edge-nav";
import { TopBar } from "./components/dashboard/top-bar";
import { HomeView } from "./components/dashboard/home-view";
import { ApprovalsView } from "./components/dashboard/approvals-view";
import { useCases } from "./components/dashboard/use-cases";
import { CustomersView } from "./components/dashboard/customers-view";
import { OrdersView } from "./components/dashboard/orders-view";
import { AnalyticsView } from "./components/dashboard/analytics-view";
import { KnowledgeView } from "./components/dashboard/knowledge-view";
import { SettingsView } from "./components/dashboard/settings-view";
import { useT } from "../lib/i18n";

interface HealthStatus {
  ok: boolean;
  hasAiGateway: boolean;
  missing: string[];
}

const VALID_VIEWS: View[] = ["home", "conversations", "approvals", "customers", "orders", "knowledge", "analytics", "settings"];

export default function Home() {
  const { t, locale, setLocale } = useT();
  const [view, setView] = useState<View>("home");
  const [showManage, setShowManage] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [pendingSend, setPendingSend] = useState<{ id: number; text: string } | null>(null);
  // Chat dock: splits the screen on Home, slides over the other screens. The panel stays mounted so the conversation persists.
  const [chatOpen, setChatOpen] = useState(false);
  // Sidebar is shown by default; the choice to hide it is remembered.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem("after-sales-sidebar") === "hidden") setSidebarOpen(false);
    } catch {}
  }, []);
  const setSidebar = (open: boolean) => {
    setSidebarOpen(open);
    try {
      localStorage.setItem("after-sales-sidebar", open ? "shown" : "hidden");
    } catch {}
  };
  const [focusChat, setFocusChat] = useState(0);
  const { cases, loaded, refresh } = useCases();
  const pendingCount = cases.filter(c => c.status === "pending_approval").length;

  useEffect(() => {
    fetch("/health")
      .then(r => r.json())
      .then((data: HealthStatus) => setHealth(data))
      .catch(() => {});
  }, []);

  // Deep links: /#approvals, /#conversations … (and the current view is kept in the URL hash).
  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "") as View;
    if (fromHash === "conversations") setChatOpen(true);
    else if (VALID_VIEWS.includes(fromHash)) setView(fromHash);
  }, []);
  useEffect(() => {
    window.history.replaceState(null, "", view === "home" ? window.location.pathname : `#${view}`);
  }, [view]);

  const showWarning = health && !health.ok;

  /** Open the chat dock and focus its input. */
  const openChat = () => {
    setChatOpen(true);
    setFocusChat(n => n + 1);
  };

  /** Open the chat dock; a non-empty prompt is sent to the agent straight away. */
  const handleAsk = (text: string) => {
    if (text.trim()) {
      setChatOpen(true);
      setPendingSend({ id: Date.now(), text });
    } else {
      openChat();
    }
  };

  const handleNavigate = (v: View) => {
    if (v === "conversations") openChat();
    else setView(v);
  };

  const handleReset = async () => {
    if (isResetting) return;

    // Reset is manager-only and verified server-side; cancelling the prompt leaves everything untouched.
    const passcode = window.prompt("Manager passcode to reset demo data (demo: manager-demo)");
    if (passcode === null) return;

    setShowResetModal(false);
    setIsResetting(true);
    try {
      const key = "after-sales-conversation-id";
      const conversationId = localStorage.getItem(key) || crypto.randomUUID();
      await fetch("/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "makers-conversation-id": conversationId,
        },
        body: JSON.stringify({ conversation_id: conversationId }),
      }).catch(() => {});
      const response = await fetch("/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "makers-conversation-id": conversationId,
        },
        body: JSON.stringify({ passcode }),
      });

      if (response.status === 401) {
        window.alert("Wrong passcode - demo data was not reset.");
        return;
      }
      if (!response.ok) throw new Error("Reset failed");

      localStorage.removeItem(key);
      setShowManage(false);
      setPendingSend(null);
      setResetVersion(version => version + 1);
      refresh();
    } catch {
      window.alert(t("ui.header.resetFailed"));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <main className="flex h-screen bg-[#F6F7FB]">
      <EdgeNav
        view={view}
        knowledgeOpen={showManage}
        chatOpen={chatOpen}
        pending={pendingCount}
        docked={sidebarOpen}
        onNavigate={handleNavigate}
        onToggleKnowledge={() => setShowManage(v => !v)}
        onDock={() => setSidebar(true)}
        onUndock={() => setSidebar(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Env config warning banner */}
        {showWarning && (
          <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2.5">
            <span className="text-amber-500 text-sm flex-shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <span className="text-[12px] text-amber-800 font-medium">{t("ui.warn.envMissing")}</span>
              {!health.hasAiGateway && (health.missing?.length ?? 0) > 0 && (
                <span className="text-[11px] text-amber-600 ml-1.5">
                  {t("ui.warn.missing", { names: (health.missing ?? []).join(locale === "en" ? ", " : "、") })}
                </span>
              )}
            </div>
            <button
              onClick={() => setHealth(h => h ? { ...h, ok: true } : h)}
              className="flex-shrink-0 text-amber-400 hover:text-amber-600 text-sm leading-none"
            >✕</button>
          </div>
        )}

        <TopBar
          pending={pendingCount}
          resetting={isResetting}
          langLabel={t("ui.header.langSwitch")}
          onReset={() => setShowResetModal(true)}
          onToggleLang={() => setLocale(locale === "en" ? "zh" : "en")}
          onOpenApprovals={() => setView("approvals")}
        />

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="@container min-w-0 flex-1 overflow-y-auto">
          {view === "home" && (
            <HomeView
              cases={cases}
              loaded={loaded}
              onAsk={handleAsk}
              onOpenApprovals={() => setView("approvals")}
              onOpenKnowledge={() => setView("knowledge")}
              split={chatOpen}
              onFocusChat={openChat}
            />
          )}
          {view === "approvals" && (
            <ApprovalsView cases={cases} loaded={loaded} onDecided={refresh} onBack={() => setView("home")} />
          )}
          {view === "customers" && <CustomersView onOpenApprovals={() => setView("approvals")} />}
          {view === "orders" && <OrdersView onAsk={handleAsk} onOpenApprovals={() => setView("approvals")} />}
          {view === "knowledge" && <KnowledgeView onAsk={handleAsk} />}
          {view === "analytics" && <AnalyticsView cases={cases} loaded={loaded} />}
          {view === "settings" && <SettingsView onReset={() => setShowResetModal(true)} />}

        </div>

        {/* Chat launcher: a persistent icon on the right edge, vertically centred, reachable from every screen. */}
        <button
          onClick={openChat}
          aria-label="Open chat"
          title="Chat with the assistant"
          tabIndex={chatOpen ? -1 : 0}
          className={`absolute right-0 top-1/2 z-20 flex h-12 w-11 -translate-y-1/2 items-center justify-center rounded-l-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[-4px_6px_20px_rgba(79,70,229,0.35)] transition-[opacity,transform] duration-200 active:scale-95 ${
            chatOpen ? "pointer-events-none translate-x-full opacity-0" : "opacity-100"
          }`}
        >
          <MessageSquare className="h-5 w-5" strokeWidth={1.9} />
        </button>

        {/* Chat dock — splits EVERY screen: the current screen keeps the left half, the chat takes the right half.
            Always mounted so the conversation persists. */}
        <aside
          aria-label="Chat"
          inert={!chatOpen}
          className={`relative flex-shrink-0 overflow-hidden border-slate-200/80 bg-white transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] ${
            chatOpen ? "w-1/2 border-l" : "w-0"
          }`}
        >
          <div className="flex h-full min-w-[360px] flex-col">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-bold text-white">AI</div>
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold text-slate-900">Assistant</div>
                  <div className="text-[11px] text-slate-400">Specialist agents work each case live</div>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
                className="press rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <ChatPanel key={resetVersion} pendingSend={pendingSend} focusSignal={focusChat} />
            </div>
          </div>
        </aside>
        </div>
      </div>

      

      {showResetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onClick={() => setShowResetModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-modal-title"
            aria-describedby="reset-modal-description"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-orange-400" />
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m0 3.75h.008M10.29 3.86 2.82 17.1A1.9 1.9 0 0 0 4.47 20h15.06a1.9 1.9 0 0 0 1.65-2.9L13.71 3.86a1.96 1.96 0 0 0-3.42 0Z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="reset-modal-title" className="text-base font-semibold text-gray-900">
                    {t("ui.header.reset")}
                  </h2>
                  <p id="reset-modal-description" className="mt-2 text-sm leading-relaxed text-gray-500">
                    {t("ui.header.resetConfirm")}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t("ui.manage.form.cancel")}
                  onClick={() => setShowResetModal(false)}
                  className="-mr-1 -mt-1 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  {t("ui.manage.form.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isResetting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("ui.header.reset")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
