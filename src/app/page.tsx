"use client";

import { useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Columns, type Card } from "@/lib/schema";
import { canvaEmbedUrl, tryCanvaOembed } from "@/lib/canva";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "ig_story_kanban_v2";

type Filters = {
  q: string;
  owner: "" | "Symone" | "Editor";
  status: "" | (typeof Columns)[number]["id"];
  priority: "" | "High" | "Medium" | "Low";
};

function nowIso() {
  return new Date().toISOString();
}

function demoCards(): Card[] {
  const t = nowIso();
  return [
    {
      id: crypto.randomUUID(),
      title: "Paydai: ‘Commissions aren’t bonuses’ story sequence",
      canvaUrl: "",
      notes: "Pull from the HR-forgot-commissions Reddit post. Pain → clarity → relief.",
      dueDate: "",
      owner: "Editor",
      priority: "High",
      status: "ideation",
      approvedBy: "",
      createdAt: t,
      updatedAt: t,
    },
    {
      id: crypto.randomUUID(),
      title: "Paydai: ‘Make commission payments boring’ framework",
      canvaUrl: "",
      notes: "6–8 slides. 1 idea per slide. End with simple CTA.",
      dueDate: "",
      owner: "Symone",
      priority: "Medium",
      status: "needs_editing",
      approvedBy: "",
      createdAt: t,
      updatedAt: t,
    },
  ];
}

function loadLocal(): Card[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return demoCards();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : demoCards();
  } catch {
    return demoCards();
  }
}

function saveLocal(cards: Card[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

async function upsertRemote(cards: Card[]) {
  if (!supabase) return;
  // naive sync: upsert all cards
  await supabase.from("ig_story_cards").upsert(cards);
}

async function loadRemote(): Promise<Card[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("ig_story_cards").select("*").order("updatedAt", { ascending: false });
  if (error) return null;
  return (data as Card[]) || [];
}

export default function Page() {
  const [cards, setCards] = useState<Card[]>([]);
  const [filters, setFilters] = useState<Filters>({ q: "", owner: "", status: "", priority: "" });

  // modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);

  const [syncMode, setSyncMode] = useState<"local" | "supabase">("local");
  const [canvaThumb, setCanvaThumb] = useState<Record<string, string>>({});

  useEffect(() => {
    // start local
    setCards(loadLocal());
  }, []);

  // attempt remote
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await loadRemote();
      if (remote && !cancelled) {
        setCards(remote.length ? remote : demoCards());
        setSyncMode("supabase");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cards.length) return;
    saveLocal(cards);
    // best-effort remote
    if (syncMode === "supabase") {
      void upsertRemote(cards);
    }
  }, [cards, syncMode]);

  // best-effort: fetch Canva thumbnail via oEmbed for nicer card previews
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      const toFetch = cards.filter((c) => c.canvaUrl && !canvaThumb[c.id]).slice(0, 10);
      for (const c of toFetch) {
        const meta = await tryCanvaOembed(c.canvaUrl || "");
        if (meta?.thumbnail_url) next[c.id] = meta.thumbnail_url;
      }
      if (!cancelled && Object.keys(next).length) {
        setCanvaThumb((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return cards.filter((c) => {
      if (filters.owner && c.owner !== filters.owner) return false;
      if (filters.status && c.status !== filters.status) return false;
      if (filters.priority && c.priority !== filters.priority) return false;
      if (!q) return true;
      const hay = `${c.title} ${c.notes ?? ""} ${c.canvaUrl ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [cards, filters]);

  const byColumn = useMemo(() => {
    const map: Record<string, Card[]> = {};
    for (const col of Columns) map[col.id] = [];
    for (const c of filtered) map[c.status].push(c);
    // simple priority ordering
    const pr = { High: 0, Medium: 1, Low: 2 } as const;
    for (const col of Columns) {
      map[col.id].sort((a, b) => (pr[a.priority] ?? 9) - (pr[b.priority] ?? 9));
    }
    return map;
  }, [filtered]);

  function updateCard(id: string, patch: Partial<Card>) {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: nowIso() } : c))
    );
  }

  function createOrUpdate(card: Omit<Card, "createdAt" | "updatedAt">) {
    setCards((prev) => {
      const exists = prev.find((c) => c.id === card.id);
      if (exists) {
        return prev.map((c) => (c.id === card.id ? { ...c, ...card, updatedAt: nowIso() } : c));
      }
      const t = nowIso();
      return [{ ...card, createdAt: t, updatedAt: t }, ...prev];
    });
  }

  function remove(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    // overId can be column id or card id
    const overIsColumn = Columns.some((c) => c.id === overId);

    if (overIsColumn) {
      updateCard(activeId, { status: overId as Card["status"] });
      return;
    }

    // if dropped on another card, reorder within same column
    const active = cards.find((c) => c.id === activeId);
    const over = cards.find((c) => c.id === overId);
    if (!active || !over) return;

    if (active.status !== over.status) {
      // move to other column, then sort by insert position
      setCards((prev) => {
        const next = [...prev];
        const fromIdx = next.findIndex((c) => c.id === activeId);
        const toIdx = next.findIndex((c) => c.id === overId);
        next[fromIdx] = { ...next[fromIdx], status: over.status, updatedAt: nowIso() };
        return arrayMove(next, fromIdx, toIdx);
      });
      return;
    }

    // same column reorder
    setCards((prev) => {
      const fromIdx = prev.findIndex((c) => c.id === activeId);
      const toIdx = prev.findIndex((c) => c.id === overId);
      return arrayMove(prev, fromIdx, toIdx);
    });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500" />
            <div>
              <div className="text-sm font-semibold">Symone IG Stories — Board</div>
              <div className="text-xs text-slate-500">
                Status tracking for Canva story sequences · Sync: <span className="font-medium">{syncMode}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const id = crypto.randomUUID();
                setEditing({
                  id,
                  title: "",
                  canvaUrl: "",
                  notes: "",
                  dueDate: "",
                  owner: "Editor",
                  priority: "Medium",
                  status: "ideation",
                  approvedBy: "",
                  createdAt: nowIso(),
                  updatedAt: nowIso(),
                });
                setOpen(true);
              }}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              New card
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-600">Search</label>
              <input
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                placeholder="Search title, notes, link…"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Owner</label>
              <select
                value={filters.owner}
                onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value as Filters["owner"] }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">All</option>
                <option value="Symone">Symone</option>
                <option value="Editor">Editor</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value as Filters["priority"] }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              >
                <option value="">All</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        <DndContext onDragEnd={onDragEnd}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {Columns.map((col) => (
              <div key={col.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between rounded-t-2xl bg-slate-100 px-4 py-3">
                  <div className="text-sm font-semibold">{col.title}</div>
                  <div className="text-xs text-slate-600">{byColumn[col.id].length}</div>
                </div>

                <div className="max-h-[72vh] space-y-3 overflow-auto p-3">
                  <SortableContext items={byColumn[col.id].map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    {/* column drop zone by using column id as over target */}
                    <div id={col.id} data-col={col.id} className="min-h-[20px]" />
                    {byColumn[col.id].map((c) => (
                      <CardTile
                        key={c.id}
                        card={c}
                        thumbUrl={canvaThumb[c.id]}
                        onEdit={() => {
                          setEditing(c);
                          setOpen(true);
                        }}
                        onPreview={() => {
                          const embed = canvaEmbedUrl(c.canvaUrl || "");
                          if (embed) setPreview({ title: c.title, url: embed });
                        }}
                      />
                    ))}
                  </SortableContext>
                </div>
              </div>
            ))}
          </div>
        </DndContext>
      </main>

      {/* edit modal */}
      {open && editing && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative mx-auto mt-10 w-[95%] max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">Edit story card</div>
                <div className="text-xs text-slate-500">Canva link + status + notes.</div>
              </div>
              <button className="rounded-lg border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Title">
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </Field>

              <Field label="Owner">
                <select
                  value={editing.owner}
                  onChange={(e) => setEditing({ ...editing, owner: e.target.value as Card["owner"] })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  <option value="Symone">Symone</option>
                  <option value="Editor">Editor</option>
                </select>
              </Field>

              <Field label="Canva URL" className="md:col-span-2">
                <input
                  value={editing.canvaUrl || ""}
                  onChange={(e) => setEditing({ ...editing, canvaUrl: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder="https://www.canva.com/design/..."
                />
                <div className="mt-1 flex items-center gap-2">
                  <button
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                    onClick={() => {
                      const embed = canvaEmbedUrl(editing.canvaUrl || "");
                      if (embed) setPreview({ title: editing.title || "Canva", url: embed });
                    }}
                  >
                    Preview
                  </button>
                  {editing.canvaUrl ? (
                    <a className="text-xs text-sky-700 underline" href={editing.canvaUrl} target="_blank" rel="noreferrer">
                      Open Canva
                    </a>
                  ) : null}
                </div>
              </Field>

              <Field label="Priority">
                <select
                  value={editing.priority}
                  onChange={(e) => setEditing({ ...editing, priority: e.target.value as Card["priority"] })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </Field>

              <Field label="Status">
                <select
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as Card["status"] })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  {Columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Due date">
                <input
                  type="date"
                  value={editing.dueDate || ""}
                  onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </Field>

              <Field label="Approved by (optional)">
                <input
                  value={editing.approvedBy || ""}
                  onChange={(e) => setEditing({ ...editing, approvedBy: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  placeholder="Faiz / Symone"
                />
              </Field>

              <Field label="Notes" className="md:col-span-2">
                <textarea
                  value={editing.notes || ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  rows={5}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </Field>

              <div className="md:col-span-2 flex items-center justify-between pt-1">
                <button
                  className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                  onClick={() => {
                    remove(editing.id);
                    setOpen(false);
                  }}
                >
                  Delete
                </button>
                <div className="flex items-center gap-2">
                  <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    onClick={() => {
                      createOrUpdate(editing);
                      setOpen(false);
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canva preview */}
      {preview && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPreview(null)} />
          <div className="relative mx-auto mt-6 w-[96%] max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="text-sm font-semibold truncate">{preview.title}</div>
              <button className="rounded-lg border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
            <div className="aspect-[16/9] w-full bg-slate-100">
              <iframe
                src={preview.url}
                className="h-full w-full"
                allow="fullscreen"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="border-t px-4 py-2 text-xs text-slate-500">
              If Canva blocks embedding for a particular link, we’ll still show the Canva URL and open it in a new tab.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function CardTile({
  card,
  thumbUrl,
  onEdit,
  onPreview,
}: {
  card: Card;
  thumbUrl?: string;
  onEdit: () => void;
  onPreview: () => void;
}) {
  const due = card.dueDate ? new Date(card.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;

  const prioClass =
    card.priority === "High"
      ? "border-red-200 bg-red-50 text-red-700"
      : card.priority === "Medium"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-sky-200 bg-sky-50 text-sky-700";

  const ownerClass = card.owner === "Symone" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <button
      onClick={onEdit}
      className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold leading-snug">{card.title}</div>
        <div className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">IG Story</div>
      </div>

      {thumbUrl ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbUrl} alt="Canva preview" className="h-28 w-full object-cover" />
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${prioClass}`}>{card.priority}</span>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${ownerClass}`}>{card.owner}</span>
        {due ? <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">Due {due}</span> : null}
      </div>

      {card.canvaUrl ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="truncate text-xs text-sky-700 underline">{card.canvaUrl}</div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
          >
            Preview
          </button>
        </div>
      ) : null}

      {card.notes ? <div className="mt-2 line-clamp-3 text-xs text-slate-600">{card.notes}</div> : null}
    </button>
  );
}
