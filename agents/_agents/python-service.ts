import type { AgentContext } from '@edgeone/types';
/**
 * Client for the Python/FastAPI risk & policy service (cloud-functions/api/index.py).
 *
 * Returns null on any failure — the caller then uses its TypeScript fallback, so the Python
 * service can be slow, cold or down without ever blocking a case. After a failure the service is
 * skipped for a short cooldown so a dead endpoint doesn't add latency to every request.
 */
import { createLogger } from "../_shared";

const logger = createLogger("python-service");
const TIMEOUT_MS = 4000;
const COOLDOWN_MS = 30_000;
let downUntil = 0;

type AgentEnv = Record<string, string | undefined>;

/** PY_SERVICE_URL wins (local dev); otherwise use the site the browser called, plus /api. */
function baseUrl(context: AgentContext, env: AgentEnv): string | null {
  if (env.PY_SERVICE_URL) return env.PY_SERVICE_URL.replace(/\/$/, "");
  const headers = (context.request?.headers ?? {}) as Record<string, string | undefined>;
  const origin = headers["origin"] ?? headers["referer"];
  if (origin) {
    try {
      return `${new URL(origin).origin}/api`;
    } catch {}
  }
  const host = headers["x-forwarded-host"];
  return host ? `${headers["x-forwarded-proto"] ?? "https"}://${host}/api` : null;
}

export async function callPython<T>(context: AgentContext, env: AgentEnv, path: string, body: unknown, signal?: AbortSignal): Promise<T | null> {
  if (Date.now() < downUntil) return null;
  const base = baseUrl(context, env);
  if (!base) return null;
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), signal]) : AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    if (signal?.aborted) return null; // the user stopped the run — that's not the service being down
    downUntil = Date.now() + COOLDOWN_MS;
    logger.error(`Python service ${path} unavailable (${(e as Error).message}); using TypeScript fallback`);
    return null;
  }
}
