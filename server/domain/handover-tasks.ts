import { randomUUID } from "node:crypto";
import {
  defineActionErrors,
  type ActionRunContext,
} from "@agent-native/core/action";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  createTasksInput,
  updateTaskInput,
  taskSchema,
  taskSummarySchema,
} from "../../shared/handover-tasks.js";
import { getDb } from "../db/index.js";
import {
  handoverTasks as tasks,
  verificationRuns,
  activityEvents,
  handoverPlans,
} from "../db/schema.js";
import { documentWorkspace } from "./documents.js";
import { getVerification, verificationErrors } from "./verification.js";
import { taskMachine as machine } from "./task-lifecycle.js";
export const taskErrors = defineActionErrors(
  "task_not_found",
  "invalid_task",
  "task_conflict",
  ...verificationErrors.codes,
);
type Access = Awaited<ReturnType<typeof documentWorkspace>>;
function scope(a: Access) {
  return and(
    eq(tasks.workspaceId, a.workspace.id),
    eq(tasks.ownerEmail, a.ownerEmail),
    eq(tasks.orgId, a.orgId),
  );
}
export function taskLinks(row: {
  id: string;
  workspaceId: string;
  runId: string | null;
  planId: string | null;
  findingId: string | null;
  documentId: string;
}) {
  const ws = encodeURIComponent(row.workspaceId);
  return {
    urlPath: `/tasks?workspaceId=${ws}&taskId=${encodeURIComponent(row.id)}`,
    runUrlPath: row.runId
      ? `/verification?workspaceId=${ws}&runId=${encodeURIComponent(row.runId)}`
      : null,
    findingUrlPath: row.findingId
      ? `/risks?workspaceId=${ws}&findingId=${encodeURIComponent(row.findingId)}`
      : null,
    planUrlPath: row.planId
      ? `/handover?workspaceId=${ws}&planId=${encodeURIComponent(row.planId)}`
      : null,
    sourceUrlPath: `/documents?workspaceId=${ws}&documentId=${encodeURIComponent(row.documentId)}`,
  };
}
function project(row: typeof tasks.$inferSelect) {
  return taskSchema.parse({
    ...row,
    status: machine.parseState(row.status),
    ...taskLinks(row),
  });
}
export const taskSummaryColumns = {
  id: tasks.id,
  workspaceId: tasks.workspaceId,
  runId: tasks.runId,
  stepNumber: tasks.stepNumber,
  documentId: tasks.documentId,
  sourceName: tasks.sourceName,
  gapResult: tasks.gapResult,
  title: tasks.title,
  planId: tasks.planId,
  findingId: tasks.findingId,
  priority: tasks.priority,
  assignmentStatus: tasks.assignmentStatus,
  assigneeId: tasks.assigneeId,
  assigneeName: tasks.assigneeName,
  dueDate: tasks.dueDate,
  status: tasks.status,
  revision: tasks.revision,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
};
export function projectTaskSummary(
  row: Parameters<typeof taskLinks>[0] & Record<string, unknown>,
) {
  return taskSummarySchema.parse({
    ...row,
    status: machine.parseState(row.status),
    ...taskLinks(row),
  });
}
export async function listTasks(
  input: { workspaceId?: string | undefined; runId?: string | undefined },
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  if (input.runId)
    await getVerification(
      { workspaceId: a.workspace.id, id: input.runId },
      ctx,
    );
  const rows = await getDb()
    .select(taskSummaryColumns)
    .from(tasks)
    .where(
      and(scope(a), input.runId ? eq(tasks.runId, input.runId) : undefined),
    )
    .orderBy(asc(tasks.dueDate), asc(tasks.id))
    .limit(101);
  return {
    workspaceId: a.workspace.id,
    tasks: rows.slice(0, 100).map((row) =>
      taskSummarySchema.parse({
        ...row,
        status: machine.parseState(row.status),
        ...taskLinks(row),
      }),
    ),
    hasMore: rows.length > 100,
  };
}
export async function getTask(
  input: { id: string; workspaceId?: string | undefined },
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const [row] = await getDb()
    .select()
    .from(tasks)
    .where(and(scope(a), eq(tasks.id, input.id)))
    .limit(1);
  if (!row)
    return taskErrors.noWrite(
      "That task could not be found.",
      "task_not_found",
      { statusCode: 404 },
    );
  return project(row);
}
export async function createTasks(
  input: z.infer<typeof createTasksInput>,
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  if (new Set(input.tasks.map((t) => t.stepNumber)).size !== input.tasks.length)
    return taskErrors.noWrite("Choose each step once.", "invalid_task", {
      statusCode: 400,
    });
  const now = new Date().toISOString();
  const result = await getDb().transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(verificationRuns)
      .where(
        and(
          eq(verificationRuns.id, input.runId),
          eq(verificationRuns.workspaceId, a.workspace.id),
          eq(verificationRuns.ownerEmail, a.ownerEmail),
          eq(verificationRuns.orgId, a.orgId),
        ),
      )
      .for("share");
    if (!run)
      return taskErrors.noWrite(
        "That verification could not be found.",
        "verification_not_found",
        { statusCode: 404 },
      );
    if (run.revision !== input.sourceRevision)
      return taskErrors.noWrite(
        "The test results changed. Refresh before creating tasks.",
        "task_conflict",
        { statusCode: 409 },
      );
    const values = input.tasks.map((item) => {
      const step = run.steps.find((s) => s.number === item.stepNumber);
      const assignee = a.saved.people.find((p) => p.id === item.assigneeId);
      if (!assignee)
        return taskErrors.noWrite(
          "Choose an owner from this workspace.",
          "person_not_found",
          { statusCode: 404 },
        );
      if (!step || !["blocked", "unclear"].includes(step.result))
        return taskErrors.noWrite(
          "Tasks must link to a saved blocked or unclear step.",
          "invalid_task",
          { statusCode: 400 },
        );
      return {
        id: randomUUID(),
        ownerEmail: a.ownerEmail,
        orgId: a.orgId,
        workspaceId: a.workspace.id,
        runId: run.id,
        stepNumber: step.number,
        documentId: run.documentId,
        sourceName: run.sourceName,
        instruction: step.instruction,
        gapNotes: step.notes,
        gapResult: step.result,
        title: item.title,
        assigneeId: assignee.id,
        assigneeName: assignee.name,
        dueDate: item.dueDate,
        status: machine.initial,
        resolution: "",
        revision: 0,
        createdAt: now,
        updatedAt: now,
        recordedBy: a.ownerEmail,
      };
    });
    const inserted = await tx
      .insert(tasks)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: tasks.id });
    if (inserted.length)
      await tx.insert(activityEvents).values({
        id: randomUUID(),
        ownerEmail: a.ownerEmail,
        orgId: a.orgId,
        workspaceId: a.workspace.id,
        actor: a.ownerEmail,
        eventType: "handover_tasks_created",
        summary: `Created ${inserted.length} handover tasks from ${run.sourceName}.`,
        createdAt: now,
      });
    const rows = await tx
      .select()
      .from(tasks)
      .where(
        and(
          scope(a),
          eq(tasks.runId, run.id),
          inArray(
            tasks.stepNumber,
            input.tasks.map((t) => t.stepNumber),
          ),
        ),
      );
    return { rows, insertedCount: inserted.length };
  });
  return {
    tasks: result.rows.map(project),
    insertedCount: result.insertedCount,
    _receipt: {
      changed: result.insertedCount > 0,
      verified: true,
      subject: input.runId,
      summary: `${result.rows.length} linked tasks read back; ${result.insertedCount} created. Existing tasks preserved.`,
    },
  };
}
export async function updateTask(
  input: z.infer<typeof updateTaskInput>,
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const saved = await getTask(input, ctx);
  if (saved.revision !== input.revision)
    return taskErrors.noWrite(
      "This task changed. Refresh before saving.",
      "task_conflict",
      { statusCode: 409 },
    );
  const assignee = input.assigneeId
    ? a.saved.people.find((p) => p.id === input.assigneeId)
    : null;
  if (input.assigneeId && !assignee)
    return taskErrors.noWrite(
      "Choose an owner from this workspace.",
      "person_not_found",
      { statusCode: 404 },
    );
  if (saved.assignmentStatus === "confirmed" && (!assignee || !input.dueDate))
    return taskErrors.noWrite(
      "Confirmed assignments need an owner and deadline.",
      "invalid_task",
      { statusCode: 400 },
    );
  if (saved.assignmentStatus === "suggested" && input.status !== "todo")
    return taskErrors.noWrite(
      "Approve the plan before starting or resolving a suggested task.",
      "invalid_task",
      { statusCode: 400 },
    );
  if (input.status === "done" && !input.resolution)
    return taskErrors.noWrite(
      "Describe what was fixed before resolving this task.",
      "invalid_task",
      { statusCode: 400 },
    );
  const now = new Date().toISOString();
  await getDb().transaction(async (tx) => {
    if (saved.planId) {
      const [plan] = await tx
        .select({ id: handoverPlans.id })
        .from(handoverPlans)
        .where(
          and(
            eq(handoverPlans.id, saved.planId),
            eq(handoverPlans.workspaceId, a.workspace.id),
            eq(handoverPlans.ownerEmail, a.ownerEmail),
            eq(handoverPlans.orgId, a.orgId),
          ),
        )
        .for("update");
      if (!plan)
        return taskErrors.noWrite(
          "The linked plan could not be found.",
          "invalid_task",
          { statusCode: 404 },
        );
    }

    const [row] = await tx
      .update(tasks)
      .set({
        title: input.title,
        description: input.description ?? saved.description,
        priority: input.priority ?? saved.priority,
        assigneeId: assignee?.id ?? null,
        assigneeName: assignee?.name ?? null,
        dueDate: input.dueDate,
        status: machine.transition(saved.status, input.status),
        resolution: input.resolution,
        revision: saved.revision + 1,
        updatedAt: now,
        recordedBy: a.ownerEmail,
      })
      .where(
        and(
          scope(a),
          eq(tasks.id, saved.id),
          eq(tasks.revision, input.revision),
          inArray(tasks.status, machine.fromStates(input.status)),
        ),
      )
      .returning({ id: tasks.id });
    if (!row)
      return taskErrors.noWrite(
        "Another edit was saved. Refresh and try again.",
        "task_conflict",
        { statusCode: 409 },
      );
    if (saved.planId)
      await tx
        .update(handoverPlans)
        .set({ revision: sql`${handoverPlans.revision}+1`, updatedAt: now })
        .where(
          and(
            eq(handoverPlans.id, saved.planId),
            eq(handoverPlans.workspaceId, a.workspace.id),
            eq(handoverPlans.ownerEmail, a.ownerEmail),
            eq(handoverPlans.orgId, a.orgId),
          ),
        );
    await tx.insert(activityEvents).values({
      id: randomUUID(),
      ownerEmail: a.ownerEmail,
      orgId: a.orgId,
      workspaceId: a.workspace.id,
      actor: a.ownerEmail,
      eventType: "handover_task_updated",
      summary: `Updated handover task: ${input.title}.`,
      createdAt: now,
    });
  });
  return {
    task: await getTask(input, ctx),
    _receipt: {
      changed: true,
      verified: true,
      subject: saved.id,
      summary: "Task saved and read back. Procedure test outcome unchanged.",
    },
  };
}
