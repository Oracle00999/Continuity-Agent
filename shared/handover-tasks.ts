import { z } from "zod";
import { documentWorkspaceInput, writeReceiptSchema } from "./documents.js";
export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);
export const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    );
  }, "Choose a valid calendar date.");
export const taskSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  runId: z.string().nullable(),
  planId: z.string().nullable(),
  findingId: z.string().nullable(),
  description: z.string(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  assignmentStatus: z.enum(["suggested", "confirmed"]),
  stepNumber: z.number().int().nullable(),
  documentId: z.string(),
  sourceName: z.string(),
  instruction: z.string(),
  gapNotes: z.string(),
  gapResult: z.enum(["blocked", "unclear"]).nullable(),
  title: z.string(),
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
  dueDate: dueDateSchema.nullable(),
  status: taskStatusSchema,
  resolution: z.string(),
  revision: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  urlPath: z.string(),
  sourceUrlPath: z.string(),
  runUrlPath: z.string().nullable(),
  findingUrlPath: z.string().nullable(),
  planUrlPath: z.string().nullable(),
});
export const taskSummarySchema = taskSchema.omit({
  description: true,
  instruction: true,
  gapNotes: true,
  resolution: true,
});
export const tasksListSchema = z.object({
  workspaceId: z.string(),
  tasks: z.array(taskSummarySchema),
  hasMore: z.boolean(),
});
export const taskListInput = documentWorkspaceInput.extend({
  runId: z.string().min(1).max(200).optional(),
});
export const taskIdInput = documentWorkspaceInput.extend({
  id: z.string().min(1).max(200),
});
export const createTasksInput = documentWorkspaceInput.extend({
  runId: z.string().min(1).max(200),
  sourceRevision: z.number().int().nonnegative(),
  tasks: z
    .array(
      z.object({
        stepNumber: z.number().int().positive(),
        title: z.string().trim().min(1).max(200),
        assigneeId: z.string().min(1).max(200),
        dueDate: dueDateSchema,
      }),
    )
    .min(1)
    .max(50),
});
export const updateTaskInput = taskIdInput.extend({
  revision: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  assigneeId: z.string().min(1).max(200).nullable(),
  dueDate: dueDateSchema.nullable(),
  status: taskStatusSchema,
  resolution: z.string().trim().max(4000),
});
export const tasksWriteSchema = z.object({
  tasks: z.array(taskSchema),
  insertedCount: z.number().int(),
  _receipt: writeReceiptSchema,
});
export const taskWriteSchema = z.object({
  task: taskSchema,
  _receipt: writeReceiptSchema,
});
