"use client";

import { useCallback, useEffect, useState } from "react";
import type { Case } from "../../../agents/_agents/types";
import { getConversationId } from "./helpers";

/** Polls /cases so the dashboard, approvals queue and activity feed stay live. */
export function useCases(intervalMs = 4000) {
  const [cases, setCases] = useState<Case[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json", "makers-conversation-id": getConversationId() },
        body: "{}",
      });
      if (res.ok) setCases(((await res.json()).cases as Case[]) ?? []);
    } catch {
      // keep the last known data
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs]);

  return { cases, loaded, refresh };
}
