"use client";

import { useEffect, useMemo, useState } from "react";
import { Columns, type Card } from "@/lib/schema";
import { canvaEmbedUrl } from "@/lib/canva";

const STORAGE_KEY = "ig_story_kanban_style_v1";

type Platform = Card["platform"];

const PLATFORM_LABEL: Record<Platform, string> = {
  ig: "📸 IG Stories",
  tt: "🎵 TikTok",
  yt: "▶ YouTube",
  tw: "𝕏 Twitter",
};

function nowIso() {
  return new Date().toISOString();
}

function decodeHtmlEntities(s: string) {
  // minimal decode for common entities in Canva embed snippets
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&#x2F;", "/")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function parseCanvaInput(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  // If user pasted the full Canva embed snippet, extract the iframe src.
  if (raw.includes("<iframe") || raw.includes("src=")) {
    const decoded = decodeHtmlEntities(raw);
    const m = decoded.match(/src=["']([^"']+)["']/i);
    if (m?.[1]) return m[1];
  }

  return raw;
}

function demoCards(): Card[] {
  const t = nowIso();
  return [
    {
      id: crypto.randomUUID(),
      status: "script",
      priority: "high",
      platform: "ig",
      slides: "7 slides",
      title: "Commission Horror Story #4",
      desc: "Rep gets ghosted after $12K deal closes. Text screenshots + reveal.",
      dueLabel: "Due Feb 6",
      canvaUrl: "",
      notes: "",
      createdAt: t,
      updatedAt: t,
    },
    {
      id: crypto.randomUUID(),
      status: "script",
      priority: "medium",
      platform: "ig",
      slides: "5 slides",
      title: '"3 Signs Your Commission is Being Stolen"',
      desc: "Educational sequence with red flags every sales rep should know.",
      dueLabel: "Due Feb 8",
      canvaUrl: "",
      notes: "",
      createdAt: t,
      updatedAt: t,
    },
    {
      id: crypto.randomUUID(),
      status: "design",
      priority: "medium",
      platform: "tw",
      slides: "4 slides",
      title: '"I Lost $45K in Unpaid Commissions"',
      desc: "Thread-style story sequence. Personal testimony format.",
      dueLabel: "Due Feb 7",
      canvaUrl: "",
      notes: "",
      createdAt: t,
      updatedAt: t,
    },
    {
      id: crypto.randomUUID(),
      status: "scheduled",
      priority: "high",
      platform: "ig",
      slides: "8 slides",
      title: "Commission Horror Story #2",
      desc: "Full sequence approved. Posting Wed 9 AM EST for peak engagement.",
      dueLabel: "Feb 5 · 9AM",
      canvaUrl: "",
      notes: "",
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
    return Array.isArray(parsed) ? (parsed as Card[]) : demoCards();
  } catch {
    return demoCards();
  }
}

function saveLocal(cards: Card[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export default function Page() {
  const [cards, setCards] = useState<Card[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);

  // edit modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);

  useEffect(() => {
    setCards(loadLocal());
  }, []);

  useEffect(() => {
    if (!cards.length) return;
    saveLocal(cards);
  }, [cards]);

  const totalActive = useMemo(() => cards.filter((c) => c.status !== "published").length, [cards]);

  const byColumn = useMemo(() => {
    const map: Record<string, Card[]> = {};
    for (const c of Columns) map[c.id] = [];
    for (const card of cards) map[card.status].push(card);
    return map;
  }, [cards]);

  function moveCard(cardId: string, toStatus: Card["status"]) {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status: toStatus, updatedAt: nowIso() } : c)));
  }

  function insertBefore(cardId: string, beforeId: string | null) {
    setCards((prev) => {
      const idx = prev.findIndex((c) => c.id === cardId);
      if (idx === -1) return prev;
      const item = prev[idx];
      const rest = prev.filter((c) => c.id !== cardId);
      if (!beforeId) return [item, ...rest];
      const toIdx = rest.findIndex((c) => c.id === beforeId);
      if (toIdx === -1) return [item, ...rest];
      rest.splice(toIdx, 0, item);
      return rest;
    });
  }

  function openEdit(card: Card) {
    setEditing(card);
    setOpen(true);
  }

  function openNew(status: Card["status"]) {
    const t = nowIso();
    setEditing({
      id: crypto.randomUUID(),
      status,
      priority: "medium",
      platform: "ig",
      slides: "",
      title: "",
      desc: "",
      dueLabel: "",
      canvaUrl: "",
      notes: "",
      createdAt: t,
      updatedAt: t,
    });
    setOpen(true);
  }

  function saveEdit() {
    if (!editing) return;
    setCards((prev) => {
      const exists = prev.some((c) => c.id === editing.id);
      if (exists) return prev.map((c) => (c.id === editing.id ? { ...editing, updatedAt: nowIso() } : c));
      return [{ ...editing, updatedAt: nowIso() }, ...prev];
    });
    setOpen(false);
  }

  function deleteEdit() {
    if (!editing) return;
    if (!confirm("Delete this card?") ) return;
    setCards((prev) => prev.filter((c) => c.id !== editing.id));
    setOpen(false);
  }

  return (
    <>
      <div className="grid-bg" />

      <div className="topbar">
        <div className="topbar-left">
          {/* simple gradient logo (no external image) */}
          <div
            className="topbar-logo"
            style={{
              background: "linear-gradient(135deg, var(--purple-bright), var(--purple-mid))",
              display: "grid",
              placeItems: "center",
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              color: "white",
              fontSize: 14,
            }}
          >
            S
          </div>
          <span className="topbar-title">Story Sequences</span>
          <span className="topbar-divider" />
          <span className="topbar-section">Kanban Board</span>
        </div>

        <div className="topbar-right">
          <div className="topbar-badge">📊 {totalActive} Active Sequences</div>
          <div className="client-select" title="Placeholder (multi-client later)">
            Client: All Clients <span className="arrow">▾</span>
          </div>
        </div>
      </div>

      <div className="board-wrapper">
        <div className="board">
          {Columns.map((col) => {
            const list = byColumn[col.id] || [];
            return (
              <div
                key={col.id}
                className={`column ${dragOverCol === col.id ? "drag-over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverCol(col.id);
                }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCol(null);
                  const cardId = e.dataTransfer.getData("text/plain");
                  if (cardId) moveCard(cardId, col.id);
                }}
              >
                <div className="column-header">
                  <div className="col-header-left">
                    <div className={`col-dot ${col.dotClass}`} />
                    <span className="col-title">{col.title}</span>
                  </div>
                  <span className="col-count">{list.length}</span>
                </div>

                <div className="column-body">
                  {list.map((card) => (
                    <div
                      key={card.id}
                      className={`card ${draggingId === card.id ? "dragging" : ""}`}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(card.id);
                        e.dataTransfer.setData("text/plain", card.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => openEdit(card)}
                    >
                      <div className={`card-priority ${card.priority}`} />

                      <div className="card-top">
                        <span className={`card-platform ${card.platform}`}>{PLATFORM_LABEL[card.platform]}</span>
                        <span className="card-slides">{card.slides || ""}</span>
                      </div>

                      {card.canvaUrl ? (
                        <button
                          className="card-canva"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const embed = canvaEmbedUrl(card.canvaUrl);
                            if (embed) setPreview({ title: card.title || "Canva", url: embed });
                          }}
                          title="Preview Canva"
                        >
                          Canva preview
                        </button>
                      ) : null}

                      <div className="card-title">{card.title}</div>
                      <div className="card-desc">{card.desc || ""}</div>

                      <div className="card-footer">
                        <span className="card-date">{card.dueLabel || ""}</span>
                      </div>
                    </div>
                  ))}

                  <div className="add-card" onClick={() => openNew(col.id)}>
                    <span className="plus">+</span> Add sequence
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Modal */}
      {open && editing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-[96%] max-w-2xl rounded-2xl border border-white/10 bg-[rgba(17,6,48,0.92)] p-8 md:p-10 text-white shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-[Syne] text-lg font-extrabold">Edit Sequence</div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">Paste Canva link and keep things moving.</div>
              </div>
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Title">
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </Field>

              <Field label="Status">
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20"
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as Card["status"] })}
                >
                  {Columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Description" className="md:col-span-2">
                <textarea
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20"
                  value={editing.desc || ""}
                  onChange={(e) => setEditing({ ...editing, desc: e.target.value })}
                />
              </Field>

              <Field label="Canva link" className="md:col-span-2">
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20"
                  value={editing.canvaUrl || ""}
                  onChange={(e) => setEditing({ ...editing, canvaUrl: parseCanvaInput(e.target.value) })}
                  placeholder="Paste Canva URL or Canva embed HTML snippet"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                    onClick={() => {
                      const embed = canvaEmbedUrl(editing.canvaUrl || "");
                      if (embed) setPreview({ title: editing.title || "Canva", url: embed });
                    }}
                    type="button"
                  >
                    Preview
                  </button>
                  {editing.canvaUrl ? (
                    <a
                      className="text-sm text-[var(--sky)] underline"
                      href={editing.canvaUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Canva
                    </a>
                  ) : null}
                </div>
              </Field>

              <Field label="Platform">
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20"
                  value={editing.platform}
                  onChange={(e) => setEditing({ ...editing, platform: e.target.value as Card["platform"] })}
                >
                  <option value="ig">IG Stories</option>
                  <option value="tt">TikTok</option>
                  <option value="tw">Twitter/X</option>
                  <option value="yt">YouTube</option>
                </select>
              </Field>

              <Field label="Slides / format">
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20"
                  value={editing.slides || ""}
                  onChange={(e) => setEditing({ ...editing, slides: e.target.value })}
                  placeholder='e.g. "7 slides" / "1 video"'
                />
              </Field>

              <Field label="Priority">
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20"
                  value={editing.priority}
                  onChange={(e) => setEditing({ ...editing, priority: e.target.value as Card["priority"] })}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </Field>

              <Field label="Due date">
                <input
                  type="date"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20"
                  value={editing.dueLabel || ""}
                  onChange={(e) => setEditing({ ...editing, dueLabel: e.target.value })}
                />
              </Field>

              <Field label="Notes" className="md:col-span-2">
                <textarea
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20"
                  value={editing.notes || ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </Field>

              <div className="md:col-span-2 flex items-center justify-between pt-2">
                <button
                  className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/20"
                  onClick={deleteEdit}
                  type="button"
                >
                  Delete
                </button>

                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                    onClick={() => setOpen(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-lg bg-[var(--purple-bright)] px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
                    onClick={saveEdit}
                    type="button"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canva Preview */}
      {preview && (
        <div className="fixed inset-0 z-[300]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPreview(null)} />
          <div className="relative mx-auto mt-6 w-[96%] max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[rgba(17,6,48,0.92)] shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="truncate font-[Syne] text-sm font-bold">{preview.title}</div>
              <button
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                onClick={() => setPreview(null)}
              >
                Close
              </button>
            </div>
            <div className="aspect-[16/9] w-full bg-black/20">
              <iframe
                src={preview.url}
                className="h-full w-full"
                allow="fullscreen"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs font-semibold text-[var(--text-secondary)]">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// assignee field removed
