import { z } from "zod";

export const ColumnId = z.enum([
  "ideation",
  "needs_editing",
  "ready_review",
  "approved",
  "scheduled",
  "posted",
]);

export const Priority = z.enum(["High", "Medium", "Low"]);
export const Owner = z.enum(["Symone", "Editor"]);

export const CardSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  canvaUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")), // YYYY-MM-DD
  owner: Owner,
  priority: Priority,
  status: ColumnId,
  approvedBy: z.string().optional().or(z.literal("")),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Card = z.infer<typeof CardSchema>;

export const Columns = [
  { id: "ideation" as const, title: "Ideation", color: "slate" },
  { id: "needs_editing" as const, title: "Needs Editing", color: "amber" },
  { id: "ready_review" as const, title: "Ready for Review", color: "sky" },
  { id: "approved" as const, title: "Approved", color: "emerald" },
  { id: "scheduled" as const, title: "Scheduled", color: "violet" },
  { id: "posted" as const, title: "Posted", color: "green" },
];
