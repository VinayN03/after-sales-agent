"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Ban,
  Bot,
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  ExternalLink,
  Eye,
  FlaskConical,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plug,
  RefreshCw,
  Route,
  RotateCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  UserCheck,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types (local copy of the /directory `settings` payload)             */
/* ------------------------------------------------------------------ */

type ToolScope = "read" | "write" | "irreversible" | "sandbox" | "model";

interface ToolInfo {
  name: string;
  description: string;
  scope: ToolScope;
  requiresApproval: boolean;
  grantedTo: string[];
}

interface SettingsPayload {
  autonomy: { autonomousBelow: number; supportApprovalUpTo: number };
  policy: { returnWindowDays: number; creditBonusPct: number };
  risk: { mediumAt: number; highAt: number; factors: Array<{ label: string; weight: number }> };
  integrations: { model: string; gatewayConfigured: boolean };
  tools: ToolInfo[];
  operators: { supportPasscodeSet: boolean; managerPasscodeSet: boolean; usingDemoDefaults: boolean };
}

interface DirectoryResponse {
  settings?: SettingsPayload;
}

interface HealthResponse {
  ok?: boolean;
  framework?: string;
  numpy?: string;
}

type LoadState = "loading" | "ready" | "error";
type HealthState = { status: "checking" } | { status: "up"; framework: string; numpy: string } | { status: "down" };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const CONVERSATION_KEY = "after-sales-conversation-id";

function readConversationId(): string {
  try {
    const stored = localStorage.getItem(CONVERSATION_KEY);
    if (stored) return stored;
  } catch {
    /* storage unavailable - fall through to a random id */
  }
  try {
    return crypto.randomUUID();
  } catch {
    return `anon-${Math.random().toString(36).slice(2)}`;
  }
}

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const formatWeight = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

const subscribeNoop = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

/* Tailwind needs full class names, so every tone is spelled out. */
type Tone = "emerald" | "amber" | "purple" | "red" | "slate" | "indigo";

const TONES: Record<Tone, { row: string; chip: string; icon: string; bar: string }> = {
  emerald: { row: "border-emerald-100 bg-emerald-50/60", chip: "bg-emerald-100 text-emerald-700", icon: "bg-emerald-100 text-emerald-600", bar: "bg-emerald-500" },
  amber: { row: "border-amber-100 bg-amber-50/60", chip: "bg-amber-100 text-amber-800", icon: "bg-amber-100 text-amber-600", bar: "bg-amber-400" },
  purple: { row: "border-purple-100 bg-purple-50/60", chip: "bg-purple-100 text-purple-700", icon: "bg-purple-100 text-purple-600", bar: "bg-purple-500" },
  red: { row: "border-red-100 bg-red-50/60", chip: "bg-red-100 text-red-700", icon: "bg-red-100 text-red-600", bar: "bg-red-500" },
  slate: { row: "border-slate-200 bg-slate-50", chip: "bg-slate-200 text-slate-700", icon: "bg-slate-200 text-slate-600", bar: "bg-slate-400" },
  indigo: { row: "border-indigo-100 bg-indigo-50/60", chip: "bg-indigo-100 text-indigo-700", icon: "bg-indigo-100 text-indigo-600", bar: "bg-indigo-500" },
};

const SCOPES: Record<ToolScope, { label: string; chip: string; icon: LucideIcon }> = {
  read: { label: "Read", chip: "bg-slate-100 text-slate-600", icon: Eye },
  model: { label: "Model", chip: "bg-indigo-50 text-indigo-700", icon: Sparkles },
  sandbox: { label: "Sandbox", chip: "bg-emerald-50 text-emerald-700", icon: FlaskConical },
  write: { label: "Write", chip: "bg-amber-50 text-amber-800", icon: Pencil },
  irreversible: { label: "Irreversible", chip: "bg-red-50 text-red-700", icon: TriangleAlert },
};

const SECTIONS = {
  autonomy: { title: "Autonomy & approval routing", subtitle: "Who decides, by refund amount and risk", icon: Route },
  policy: { title: "Policy & risk model", subtitle: "Return rules and how fraud risk is scored", icon: SlidersHorizontal },
  tools: { title: "Tool permissions", subtitle: "What each agent may call", icon: Wrench },
  integrations: { title: "Integrations", subtitle: "Model gateway, Python service and chat widget", icon: Plug },
  operators: { title: "Operator access", subtitle: "How human approvers are verified", icon: KeyRound },
} as const;

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Chip({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

function Card({
  title,
  subtitle,
  icon: Icon,
  index,
  className = "",
  tone = "indigo",
  aside,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  index: number;
  className?: string;
  tone?: "indigo" | "red";
  aside?: ReactNode;
  children: ReactNode;
}) {
  const iconTone = tone === "red" ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600";
  const border = tone === "red" ? "border-red-100" : "border-slate-100";
  return (
    <section
      className={`fade-up flex h-full flex-col rounded-2xl border ${border} bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)] ${className}`}
      style={{ "--i": index } as CSSProperties}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconTone}`}>
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold leading-tight text-slate-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[11px] leading-tight text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

function SkeletonLine({ className }: { className: string }) {
  return <div className={`h-3 animate-pulse rounded bg-slate-100 motion-reduce:animate-none ${className}`} />;
}

function SkeletonCard({
  section,
  index,
  rows,
  className = "",
}: {
  section: keyof typeof SECTIONS;
  index: number;
  rows: number;
  className?: string;
}) {
  const meta = SECTIONS[section];
  return (
    <Card title={meta.title} subtitle="Loading configuration..." icon={meta.icon} index={index} className={className}>
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none" />
            <div className="flex-1 space-y-1.5">
              <SkeletonLine className="w-2/5" />
              <SkeletonLine className="w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Section 1: autonomy ladder                                          */
/* ------------------------------------------------------------------ */

function LadderRow({
  tone,
  icon: Icon,
  when,
  outcome,
}: {
  tone: Tone;
  icon: LucideIcon;
  when: string;
  outcome: string;
}) {
  const t = TONES[tone];
  return (
    <li className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${t.row}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${t.icon}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-[13px] font-medium text-slate-700">{when}</span>
      <Chip className={t.chip}>{outcome}</Chip>
    </li>
  );
}

function AutonomyCard({ s, index }: { s: SettingsPayload; index: number }) {
  const { autonomousBelow: low, supportApprovalUpTo: high } = s.autonomy;
  return (
    <Card title={SECTIONS.autonomy.title} subtitle={SECTIONS.autonomy.subtitle} icon={SECTIONS.autonomy.icon} index={index}>
      {/* Amount scale */}
      <div aria-hidden="true" className="mb-3">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          <div className={`flex-1 ${TONES.emerald.bar}`} />
          <div className={`flex-1 ${TONES.amber.bar}`} />
          <div className={`flex-1 ${TONES.purple.bar}`} />
        </div>
        <div className="relative mt-1 h-4 text-[11px] font-medium tabular-nums text-slate-500">
          <span className="absolute left-0">{usd(0)}</span>
          <span className="absolute left-1/3 -translate-x-1/2">{usd(low)}</span>
          <span className="absolute left-2/3 -translate-x-1/2">{usd(high)}</span>
          <span className="absolute right-0">and up</span>
        </div>
      </div>

      <ul className="space-y-1.5">
        <LadderRow tone="emerald" icon={Bot} when={`Refund under ${usd(low)}`} outcome="Autonomous" />
        <LadderRow tone="amber" icon={UserCheck} when={`${usd(low)} to ${usd(high)}`} outcome="Support-agent approval" />
        <LadderRow tone="purple" icon={ShieldCheck} when={`Over ${usd(high)}`} outcome="Manager approval" />
      </ul>

      <div className="my-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-100" />
        Overrides
        <span className="h-px flex-1 bg-slate-100" />
      </div>

      <ul className="space-y-1.5">
        <LadderRow tone="red" icon={ShieldAlert} when="High fraud risk" outcome="Escalated to manager" />
        <LadderRow tone="slate" icon={Ban} when="Fails return policy" outcome="Denied" />
      </ul>

      <div className="mt-auto pt-3">
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] leading-snug text-slate-600">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          Thresholds live in code, not in a prompt, so a prompt injection cannot move them.
        </p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Section 2: policy & risk                                            */
/* ------------------------------------------------------------------ */

function StatTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-[20px] font-bold leading-none tabular-nums text-slate-900">{value}</span>
        <span className="text-[12px] text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

function PolicyCard({ s, index }: { s: SettingsPayload; index: number }) {
  const { returnWindowDays, creditBonusPct } = s.policy;
  const { mediumAt, highAt } = s.risk;
  const factors = s.risk.factors ?? [];
  const scaleMax = Math.max(100, highAt);
  const mediumPct = Math.min(100, (mediumAt / scaleMax) * 100);
  const highPct = Math.min(100, (highAt / scaleMax) * 100);
  const maxWeight = Math.max(...factors.map(f => Math.abs(f.weight)), 1);

  return (
    <Card title={SECTIONS.policy.title} subtitle={SECTIONS.policy.subtitle} icon={SECTIONS.policy.icon} index={index}>
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile label="Return window" value={String(returnWindowDays)} unit="days" />
        <StatTile label="Store-credit bonus" value={`+${creditBonusPct}`} unit="%" />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-[12px] font-semibold text-slate-700">Risk levels</div>
        <div className="flex h-2 overflow-hidden rounded-full" aria-hidden="true">
          <div className="bg-emerald-400" style={{ width: `${mediumPct}%` }} />
          <div className="bg-amber-400" style={{ width: `${Math.max(0, highPct - mediumPct)}%` }} />
          <div className="flex-1 bg-red-500" />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip className="bg-emerald-50 text-emerald-700">Low &lt; {mediumAt}</Chip>
          <Chip className="bg-amber-50 text-amber-800">Medium &ge; {mediumAt}</Chip>
          <Chip className="bg-red-50 text-red-700">High &ge; {highAt}</Chip>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12px] font-semibold text-slate-700">Risk factors</span>
          <span className="text-[11px] text-slate-400">weight in score</span>
        </div>
        {factors.length === 0 ? (
          <p className="text-[12px] text-slate-400">No risk factors configured.</p>
        ) : (
          <ul className="space-y-2">
            {factors.map(f => (
              <li key={f.label} className="grid grid-cols-[minmax(0,9.5rem)_1fr_2rem] items-center gap-2.5">
                <span className="truncate text-[12px] text-slate-600" title={f.label}>{f.label}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    style={{ width: `${Math.max(4, (Math.abs(f.weight) / maxWeight) * 100)}%` }}
                  />
                </span>
                <span className="text-right text-[12px] font-semibold tabular-nums text-slate-700">{formatWeight(f.weight)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Section 3: tool permissions                                         */
/* ------------------------------------------------------------------ */

function ToolsCard({ s, index }: { s: SettingsPayload; index: number }) {
  const tools = s.tools ?? [];
  const approvalCount = tools.filter(t => t.requiresApproval).length;
  return (
    <Card
      title={SECTIONS.tools.title}
      subtitle={SECTIONS.tools.subtitle}
      icon={SECTIONS.tools.icon}
      index={index}
      className="@7xl:col-span-2"
      aside={
        <span className="hidden text-[11px] font-medium text-slate-500 @2xl:block">
          {tools.length} tools &middot; {approvalCount} need approval
        </span>
      }
    >
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th scope="col" className="pb-2 pr-3 font-semibold">Tool</th>
              <th scope="col" className="pb-2 pr-3 font-semibold">Scope</th>
              <th scope="col" className="pb-2 pr-3 font-semibold">Approval</th>
              <th scope="col" className="pb-2 font-semibold">Granted to</th>
            </tr>
          </thead>
          <tbody>
            {tools.map(tool => {
              const scope = SCOPES[tool.scope] ?? SCOPES.read;
              const ScopeIcon = scope.icon;
              return (
                <tr key={tool.name} className="border-t border-slate-100 align-top">
                  <td className="py-2.5 pr-3">
                    <div className="font-mono text-[12px] font-semibold text-slate-800">{tool.name}</div>
                    <div className="mt-0.5 max-w-[340px] text-[11px] leading-snug text-slate-400">{tool.description}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Chip className={scope.chip}>
                      <ScopeIcon className="h-3 w-3" aria-hidden="true" />
                      {scope.label}
                    </Chip>
                  </td>
                  <td className="py-2.5 pr-3">
                    {tool.requiresApproval ? (
                      <Chip className="bg-amber-50 text-amber-800">
                        <UserCheck className="h-3 w-3" aria-hidden="true" />
                        Needs approval
                      </Chip>
                    ) : (
                      <span className="text-[11px] text-slate-400">No approval</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    {tool.grantedTo.length === 0 ? (
                      <span className="text-[11px] italic text-slate-400">No agent</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {tool.grantedTo.map(agent => (
                          <span key={agent} className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
                            {agent}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] leading-snug text-slate-600">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        Deny-by-default: an agent can only call the tools granted to it; the model can propose but never execute.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Section 4: integrations                                             */
/* ------------------------------------------------------------------ */

function IntegrationRow({
  icon: Icon,
  title,
  status,
  children,
}: {
  icon: LucideIcon;
  title: string;
  status: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-[13px] font-semibold text-slate-800">{title}</span>
          {status}
        </div>
        <div className="mt-0.5 text-[12px] leading-snug text-slate-500">{children}</div>
      </div>
    </div>
  );
}

function IntegrationsCard({ s, health, index }: { s: SettingsPayload; health: HealthState; index: number }) {
  const origin = useSyncExternalStore(subscribeNoop, getOrigin, getServerOrigin);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snippet = `<script src="${origin}/embed.js" async></script>`;

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    let next: "copied" | "failed" = "copied";
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      next = "failed";
    }
    setCopyState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState("idle"), 1800);
  }

  const gatewayOk = s.integrations.gatewayConfigured;

  return (
    <Card title={SECTIONS.integrations.title} subtitle={SECTIONS.integrations.subtitle} icon={SECTIONS.integrations.icon} index={index}>
      <div className="space-y-2">
        <IntegrationRow
          icon={Sparkles}
          title="AI gateway"
          status={
            gatewayOk ? (
              <Chip className="bg-emerald-50 text-emerald-700">
                <CircleCheck className="h-3 w-3" aria-hidden="true" />
                Configured
              </Chip>
            ) : (
              <Chip className="bg-amber-50 text-amber-800">
                <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                Not configured
              </Chip>
            )
          }
        >
          Model <span className="font-mono text-[11px] font-semibold text-slate-700">{s.integrations.model}</span>
        </IntegrationRow>

        <IntegrationRow
          icon={Server}
          title="Python FastAPI service"
          status={
            health.status === "up" ? (
              <Chip className="bg-emerald-50 text-emerald-700">
                <CircleCheck className="h-3 w-3" aria-hidden="true" />
                Online
              </Chip>
            ) : health.status === "checking" ? (
              <Chip className="bg-slate-100 text-slate-500">Checking...</Chip>
            ) : (
              <Chip className="bg-amber-50 text-amber-800">
                <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                Offline
              </Chip>
            )
          }
        >
          {health.status === "up" ? (
            <>
              <span className="font-medium text-slate-600">{health.framework}</span> &middot; numpy{" "}
              <span className="font-mono text-[11px] font-semibold text-slate-700">{health.numpy}</span>
            </>
          ) : health.status === "checking" ? (
            "Checking /api/health..."
          ) : (
            "Not reachable - TypeScript fallback active"
          )}
        </IntegrationRow>
      </div>

      <div className="mt-3 rounded-xl border border-slate-100 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-slate-800">Embed the chat widget</span>
          <button
            type="button"
            onClick={copy}
            className="press inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {copyState === "copied" ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span aria-live="polite">{copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}</span>
          </button>
        </div>
        <code className="block select-all overflow-x-auto whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2.5 font-mono text-[11px] leading-none text-slate-100">
          <span className="text-violet-300">&lt;script</span> <span className="text-sky-300">src</span>=<span className="text-emerald-300">&quot;{origin}/embed.js&quot;</span> <span className="text-sky-300">async</span>
          <span className="text-violet-300">&gt;&lt;/script&gt;</span>
        </code>
        <p className="mt-2 text-[11px] leading-snug text-slate-400">Paste before the closing body tag of any storefront page.</p>
        <a
          href="/embed-demo"
          target="_blank"
          rel="noopener noreferrer"
          className="press mt-1.5 inline-flex items-center gap-1 rounded text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          Preview on a demo storefront
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Section 5: operator access                                          */
/* ------------------------------------------------------------------ */

function OperatorRow({ role, detail, passcodeSet }: { role: string; detail: string; passcodeSet: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-slate-800">{role}</div>
        <div className="text-[11px] leading-snug text-slate-500">{detail}</div>
      </div>
      {passcodeSet ? (
        <Chip className="bg-emerald-50 text-emerald-700">
          <CircleCheck className="h-3 w-3" aria-hidden="true" />
          Passcode set via environment
        </Chip>
      ) : (
        <Chip className="bg-amber-50 text-amber-800">
          <TriangleAlert className="h-3 w-3" aria-hidden="true" />
          Demo default in use
        </Chip>
      )}
    </div>
  );
}

function OperatorsCard({ s, index }: { s: SettingsPayload; index: number }) {
  const { supportPasscodeSet, managerPasscodeSet, usingDemoDefaults } = s.operators;
  return (
    <Card title={SECTIONS.operators.title} subtitle={SECTIONS.operators.subtitle} icon={SECTIONS.operators.icon} index={index}>
      <p className="mb-3 text-[12px] leading-snug text-slate-600">
        Approver roles are verified server-side with passcodes. The browser never decides who is allowed to approve, and passcode values are never shown here.
      </p>
      <div className="space-y-2">
        <OperatorRow role="Support agent" detail={`Approves refunds up to ${usd(s.autonomy.supportApprovalUpTo)}`} passcodeSet={supportPasscodeSet} />
        <OperatorRow role="Manager" detail="Approves any amount and escalated cases; can reset demo data" passcodeSet={managerPasscodeSet} />
      </div>
      {usingDemoDefaults && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-[12px] leading-snug text-amber-900">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
          Demo defaults are active. Fine for a demo; set your own passcodes in the server environment before going live.
        </p>
      )}
      <p className="mt-auto flex items-start gap-2 pt-3 text-[12px] leading-snug text-slate-500">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        Production would use an SSO session.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function SettingsView({ onReset }: { onReset: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [health, setHealth] = useState<HealthState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    const headers = { "content-type": "application/json", "makers-conversation-id": readConversationId() };

    (async () => {
      try {
        const res = await fetch("/directory", { method: "POST", headers, body: "{}" });
        if (!res.ok) throw new Error(`directory ${res.status}`);
        const data = (await res.json()) as DirectoryResponse;
        if (!data.settings) throw new Error("directory response had no settings");
        if (!cancelled) {
          setSettings(data.settings);
          setLoadState("ready");
        }
      } catch {
        if (!cancelled) setLoadState("error");
      }
    })();

    (async () => {
      try {
        const res = await fetch("/api/health", { headers });
        if (!res.ok) throw new Error(`health ${res.status}`);
        const data = (await res.json()) as HealthResponse;
        if (!data.ok) throw new Error("health not ok");
        if (!cancelled) setHealth({ status: "up", framework: data.framework ?? "fastapi", numpy: data.numpy ?? "unknown" });
      } catch {
        if (!cancelled) setHealth({ status: "down" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setLoadState("loading");
    setHealth({ status: "checking" });
    setAttempt(n => n + 1);
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 pb-6 pt-2">
      <div className="mb-3">
        <h2 className="text-[20px] font-bold text-slate-900">Settings</h2>
        <p className="text-[12px] text-slate-500">How the assistant is configured and what it is allowed to do</p>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 @7xl:grid-cols-2">
        {loadState === "ready" && settings ? (
          <>
            <AutonomyCard s={settings} index={0} />
            <PolicyCard s={settings} index={1} />
            <ToolsCard s={settings} index={2} />
            <IntegrationsCard s={settings} health={health} index={3} />
            <OperatorsCard s={settings} index={4} />
          </>
        ) : loadState === "error" ? (
          <div className="fade-up flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-16 text-center @7xl:col-span-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-500">
              <CircleAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="mt-3 text-[15px] font-semibold text-slate-700">We couldn&apos;t load the configuration</div>
            <p className="mt-1 max-w-md text-[13px] text-slate-400">
              The directory service didn&apos;t respond. Check that the app server is running, then try again.
            </p>
            <button
              type="button"
              onClick={retry}
              className="press mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : (
          <>
            <SkeletonCard section="autonomy" index={0} rows={5} />
            <SkeletonCard section="policy" index={1} rows={5} />
            <SkeletonCard section="tools" index={2} rows={4} className="@7xl:col-span-2" />
            <SkeletonCard section="integrations" index={3} rows={3} />
            <SkeletonCard section="operators" index={4} rows={3} />
          </>
        )}

        <Card
          title="Danger zone"
          subtitle="Actions that can't be undone"
          icon={TriangleAlert}
          tone="red"
          index={5}
          className="@7xl:col-span-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-[12px] leading-snug text-slate-600">
              Reset demo data restores the demo to its starting state. It needs the manager passcode, so a support agent cannot trigger it.
            </p>
            <button
              type="button"
              onClick={onReset}
              className="press inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset demo data
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
