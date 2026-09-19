"use client";

/**
 * Standalone customer chat — this page is what public/embed.js loads inside its iframe, and it
 * also works on its own at /widget. Customer variant: no agent internals, no approval controls.
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ChatPanel } from "../components/chat-panel";

export default function WidgetPage() {
  const [embedded, setEmbedded] = useState(false);
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    setEmbedded(window.parent !== window);
    setDemo(new URLSearchParams(window.location.search).has("demo"));
  }, []);

  return (
    <main className="flex h-screen flex-col bg-white">
      <header className="flex flex-shrink-0 items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold">A</div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold leading-tight">After-Sales Assistant</div>
          <div className="flex items-center gap-1.5 text-[11px] text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Online · replies in seconds
          </div>
        </div>
        {embedded && (
          <button
            onClick={() => window.parent.postMessage({ source: "after-sales-widget", type: "close" }, "*")}
            aria-label="Close chat"
            className="press rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1">
        <ChatPanel variant="customer" showDemo={demo} />
      </div>
    </main>
  );
}
