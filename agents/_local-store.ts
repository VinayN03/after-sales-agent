import type { AgentContext } from '@edgeone/types';
/**
 * Local-development fallback for the platform store.
 *
 * `edgeone makers dev` keeps orders/state in EdgeOne cloud blob storage. When that host is
 * unreachable from a developer machine every store call blocks for ~10s. With
 * LOCAL_STORE_FALLBACK=1 in .env, calls get a short timeout and, once one fails, fall back to an
 * in-memory store for a few minutes. Without the flag this is a no-op, so deployed behaviour is unchanged.
 */
const REMOTE_TIMEOUT_MS = 2000;
const COOLDOWN_MS = 5 * 60_000;

const mem = new Map<string, unknown>();
let downUntil = 0;

const memKey = (ns: string[], key: string) => `${ns.join("\u0000")}\u0001${key}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

async function remote<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  if (Date.now() < downUntil) return { ok: false };
  try {
    const value = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("store timeout")), REMOTE_TIMEOUT_MS)),
    ]);
    return { ok: true, value };
  } catch (e) {
    downUntil = Date.now() + COOLDOWN_MS;
    console.warn(`[local-store] platform store unavailable (${(e as Error).message}); using in-memory fallback`);
    return { ok: false };
  }
}

function wrapKv(kv: any) {
  return {
    async get(ns: string[], key: string) {
      const r = await remote(() => kv.get(ns, key));
      if (r.ok) return r.value;
      const value = mem.get(memKey(ns, key));
      return value ? { namespace: ns, key, value: clone(value) } : null;
    },
    async put(ns: string[], key: string, value: unknown, ...rest: unknown[]) {
      const r = await remote(() => kv.put(ns, key, value, ...rest));
      if (!r.ok) mem.set(memKey(ns, key), clone(value));
    },
    async delete(ns: string[], key: string) {
      const r = await remote(() => kv.delete(ns, key));
      if (!r.ok) mem.delete(memKey(ns, key));
    },
    async search(ns: string[], options?: { limit?: number }) {
      const r = await remote(() => kv.search(ns, options));
      if (r.ok) return r.value;
      const prefix = `${ns.join("\u0000")}\u0001`;
      return [...mem.entries()]
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, value]) => ({ namespace: ns, key: k.slice(prefix.length), value: clone(value) }))
        .slice(0, options?.limit ?? 100);
    },
  };
}

export function withLocalFallbackStore(context: AgentContext): AgentContext {
  if (context.env?.LOCAL_STORE_FALLBACK !== "1" || !context.store) return context;

  const target = context.store as any;
  const kv = wrapKv(target.langgraphStore);
  const store = new Proxy(target, {
    get(t, prop) {
      if (prop === "langgraphStore") return kv;
      const v = Reflect.get(t, prop, t);
      if (typeof v !== "function") return v;
      // Other store methods (e.g. appendMessage): bound, with the same timeout / fallback behaviour.
      return async (...args: unknown[]) => {
        const r = await remote(() => v.apply(t, args));
        return r.ok ? r.value : undefined;
      };
    },
  });
  return new Proxy(context, {
    get(t, prop) {
      return prop === "store" ? store : Reflect.get(t, prop, t);
    },
  });
}
