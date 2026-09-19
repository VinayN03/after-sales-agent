"use client";

import { useState, useEffect } from "react";
import { ChatPanel } from "./components/chat-panel";
import { ManagePanel } from "./components/manage-panel";
import { EdgeNav, type View } from "./components/dashboard/edge-nav";
import { TopBar } from "./components/dashboard/top-bar";
import { HomeView } from "./components/dashboard/home-view";
import { ApprovalsView } from "./components/dashboard/approvals-view";
import { useCases } from "./components/dashboard/use-cases";
import { useT } from "../lib/i18n";

interface HealthStatus {
  ok: boolean;
  hasAiGateway: boolean;
  missing: string[];
}

const PLACEHOLDER_VIEWS: View[] = ["customers", "orders", "analytics", "settings"];

export default function Home() {
  const { t, locale, setLocale } = useT();
  const [view, setView] = useState<View>("home");
  const [showManage, setShowManage] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [pendingSend, setPendingSend] = useState<{ id: number; text: string } | null>(null);
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
    if (["home", "conversations", "approvals", ...PLACEHOLDER_VIEWS].includes(fromHash)) setView(fromHash);
  }, []);
  useEffect(() => {
    window.history.replaceState(null, "", view === "home" ? window.location.pathname : `#${view}`);
  }, [view]);

  const showWarning = health && !health.ok;

  /** Open the conversation view; a non-empty prompt is sent to the agent straight away. */
  const handleAsk = (text: string) => {
    setView("conversations");
    if (text.trim()) setPendingSend({ id: Date.now(), text });
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
        onNavigate={setView}
        onToggleKnowledge={() => setShowManage(v => !v)}
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === "home" && (
            <HomeView
              cases={cases}
              loaded={loaded}
              onAsk={handleAsk}
              onOpenApprovals={() => setView("approvals")}
              onOpenKnowledge={() => setShowManage(true)}
            />
          )}
          {view === "approvals" && (
            <ApprovalsView cases={cases} loaded={loaded} onDecided={refresh} onBack={() => setView("home")} />
          )}
          {PLACEHOLDER_VIEWS.includes(view) && (
            <div className="flex h-full items-center justify-center pb-24">
              <div className="text-center">
                <div className="text-[18px] font-semibold capitalize text-slate-700">{view}</div>
                <div className="mt-1 text-[13px] text-slate-400">Coming soon</div>
              </div>
            </div>
          )}

          {/* Kept mounted (hidden when inactive) so the conversation survives switching views. */}
          <div className={view === "conversations" ? "h-full px-6 pb-4" : "hidden"}>
            <div className="h-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
              <ChatPanel key={resetVersion} pendingSend={pendingSend} />
            </div>
          </div>
        </div>
      </div>

      {showManage && (
        <aside className="w-[380px] flex-shrink-0 border-l border-gray-200/80 bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
          <ManagePanel onClose={() => setShowManage(false)} />
        </aside>
      )}

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
