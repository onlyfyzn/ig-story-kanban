import { z } from "zod";

export const ColumnId = z.enum(["script", "design", "review", "scheduled", "published"]);

export const Priority = z.enum(["high", "medium", "low"]);
export const Platform = z.enum(["ig", "tt", "yt", "tw"]);
export const Assignee = z.enum(["F", "J", "M", "A", "S", "E"]);

export const CardSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  desc: z.string().optional().or(z.literal("")),
  canvaUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  dueLabel: z.string().optional().or(z.literal("")), // e.g. "Due Feb 6" or "Feb 5 · 9AM"
  platform: Platform,
  slides: z.string().optional().or(z.literal("")), // e.g. "7 slides" / "1 video"
  tags: z.array(z.string()).default([]),
  assignee: Assignee,
  priority: Priority,
  status: ColumnId,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Card = z.infer<typeof CardSchema>;

export const Columns = [
  { id: "script" as const, title: "Script / Ideation", dotClass: "script" },
  { id: "design" as const, title: "In Design", dotClass: "design" },
  { id: "review" as const, title: "Client Review", dotClass: "review" },
  { id: "scheduled" as const, title: "Scheduled", dotClass: "scheduled" },
  { id: "published" as const, title: "Published", dotClass: "published" },
];
