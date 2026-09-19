"use client";

/**
 * Knowledge base — the policies, FAQs and product documents the assistant routes questions to.
 * A full screen (like Customers / Orders): search, filter by type, read, edit and delete documents.
 * Backed by the /manage endpoint (list · get · edit · delete).
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, MessageSquare, Pencil, Search, Trash2 } from "lucide-react";
import { fmtDate, getConversationId } from "./helpers";

interface Doc {
  docId: string;
  category: "faq" | "policy" | "product" | "order_doc";
  filename: string;
  summary: string;
  keywords: string[];
  charCount: number;
  uploadedAt: string;
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "policy", label: "Policies" },
  { id: "faq", label: "FAQs" },
  { id: "product", label: "Products" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const CAT_STYLE: Record<Doc["category"], string> = {
  policy: "bg-amber-100 text-amber-700",
  faq: "bg-indigo-100 text-indigo-700",
  product: "bg-emerald-100 text-emerald-700",
  order_doc: "bg-slate-100 text-slate-600",
};
const CAT_LABEL: Record<Doc["category"], string> = { policy: "Policy", faq: "FAQ", product: "Product", order_doc: "Order" };
const COLS = "grid-cols-[2.1fr_0.8fr_3fr_0.9fr_24px]";

async function manage(body: Record<string, unknown>) {
  const res = await fetch("/manage", {
    method: "POST",
    headers: { "Content-Type": "application/json", "makers-conversation-id": getConversationId() },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export function KnowledgeView({ onAsk }: { onAsk: (text: string) => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", content: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await manage({ action: "list" });
      setDocs(((data.documents ?? []) as Doc[]).filter(d => d.category !== "order_doc"));
    } catch {
      // keep what we have
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () =>
      docs
        .filter(d => (filter === "all" || d.category === filter) && `${d.filename} ${d.summary} ${d.keywords.join(" ")}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.category.localeCompare(b.category) || a.filename.localeCompare(b.filename)),
    [docs, filter, query],
  );
  const count = (f: Filter) => (f === "all" ? docs.length : docs.filter(d => d.category === f).length);

  const toggle = async (d: Doc) => {
    setError("");
    setEditing(null);
    if (open === d.docId) return setOpen(null);
    setOpen(d.docId);
    if (contents[d.docId] === undefined) {
      try {
        const data = await manage({ action: "get", docId: d.docId, category: d.category });
        setContents(prev => ({ ...prev, [d.docId]: data.content as string }));
      } catch (e) {
        setError((e as Error).message);
      }
    }
  };

  const save = async (d: Doc) => {
    setBusy(true);
    setError("");
    try {
      await manage({ action: "edit", docId: d.docId, category: d.category, title: draft.title, content: draft.content });
      setContents(prev => ({ ...prev, [d.docId]: draft.content }));
      setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: Doc) => {
    if (!window.confirm(`Delete "${d.filename}" from the knowledge base?`)) return;
    setBusy(true);
    setError("");
    try {
      await manage({ action: "delete", docId: d.docId, category: d.category });
      setOpen(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 pb-6 pt-2">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-slate-900">Knowledge base</h2>
          <p className="text-[12px] text-slate-500">
            The policies, FAQs and product documents the assistant routes questions to. {docs.length} documents.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search documents"
              className="w-40 bg-transparent text-[12px] text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-medium">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`press whitespace-nowrap rounded-md px-2.5 py-1 ${filter === f.id ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-700"}`}
              >
                {f.label} <span className={filter === f.id ? "text-indigo-200" : "text-slate-400"}>{count(f.id)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
        <div className="min-w-[640px]">
          <div className={`grid ${COLS} gap-3 border-b border-slate-100 pb-2 text-[11px] font-medium text-slate-400`}>
            <span>Document</span><span>Type</span><span>Summary</span><span>Added</span><span />
          </div>

          {rows.map((d, i) => {
            const isOpen = open === d.docId;
            const body = contents[d.docId];
            return (
              <Fragment key={d.docId}>
                <div
                  onClick={() => toggle(d)}
                  style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                  className={`fade-up grid ${COLS} cursor-pointer items-center gap-3 border-b border-slate-50 py-2.5 text-[12px] hover:bg-slate-50/60`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
                      <BookOpen className="h-4 w-4" strokeWidth={1.8} />
                    </div>
                    <span className="truncate font-medium text-slate-800">{d.filename}</span>
                  </div>
                  <div><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CAT_STYLE[d.category]}`}>{CAT_LABEL[d.category]}</span></div>
                  <div className="line-clamp-2 leading-snug text-slate-500">{d.summary}</div>
                  <div className="text-slate-400">{fmtDate(d.uploadedAt)}</div>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </div>

                {isOpen && (
                  <div className="fade-up space-y-2.5 border-b border-slate-100 bg-slate-50/60 px-3 py-3">
                    {d.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {d.keywords.map(k => (
                          <span key={k} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] text-slate-500">{k}</span>
                        ))}
                      </div>
                    )}

                    {editing === d.docId ? (
                      <div className="space-y-2">
                        <input
                          value={draft.title}
                          onChange={e => setDraft(p => ({ ...p, title: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-800 outline-none focus:border-indigo-300"
                        />
                        <textarea
                          value={draft.content}
                          onChange={e => setDraft(p => ({ ...p, content: e.target.value }))}
                          rows={10}
                          className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] leading-relaxed text-slate-700 outline-none focus:border-indigo-300"
                        />
                      </div>
                    ) : (
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-100 bg-white p-3 font-sans text-[12px] leading-relaxed text-slate-700">
                        {body ?? "Loading…"}
                      </pre>
                    )}

                    {error && <div className="text-[11px] text-red-600">⛔ {error}</div>}

                    <div className="flex flex-wrap items-center gap-2">
                      {editing === d.docId ? (
                        <>
                          <button onClick={() => save(d)} disabled={busy} className="press rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                            {busy ? "Saving…" : "Save changes"}
                          </button>
                          <button onClick={() => setEditing(null)} className="press rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => onAsk(`What does our policy say about: ${d.filename}?`)}
                            className="press flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            <MessageSquare className="h-3.5 w-3.5" /> Ask the assistant
                          </button>
                          <button
                            onClick={() => {
                              setDraft({ title: d.filename, content: body ?? "" });
                              setEditing(d.docId);
                            }}
                            disabled={body === undefined}
                            className="press flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => remove(d)}
                            disabled={busy}
                            className="press flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                          <span className="ml-auto text-[10.5px] text-slate-400">{d.charCount.toLocaleString()} characters</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })}

          {loaded && rows.length === 0 && <div className="py-10 text-center text-[12px] text-slate-400">No documents match.</div>}
          {!loaded && <div className="py-10 text-center text-[12px] text-slate-400">Loading documents…</div>}
        </div>
      </div>
    </div>
  );
}
