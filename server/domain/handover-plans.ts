import { randomUUID } from "node:crypto";
import {
  defineActionErrors,
  type ActionRunContext,
} from "@agent-native/core/action";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  draftPlanInput,
  reviewPlanInput,
  planSummarySchema,
  planSchema,
} from "../../shared/handover-plans.js";
import { getDb } from "../db/index.js";
import {
  handoverPlans as plans,
  handoverTasks as tasks,
  findings,
  findingEvidence,
  activityEvents,
} from "../db/schema.js";
import { documentWorkspace } from "./documents.js";
import {
  taskErrors,
  taskSummaryColumns,
  projectTaskSummary,
} from "./handover-tasks.js";
import { riskErrors } from "./risks.js";
export const planErrors = defineActionErrors(
  "plan_not_found",
  "invalid_plan",
  "plan_conflict",
  ...taskErrors.codes,
  ...riskErrors.codes,
);
type Access = Awaited<ReturnType<typeof documentWorkspace>>;
function scope(a: Access) {
  return and(
    eq(plans.workspaceId, a.workspace.id),
    eq(plans.ownerEmail, a.ownerEmail),
    eq(plans.orgId, a.orgId),
  );
}
function taskScope(a: Access) {
  return and(
    eq(tasks.workspaceId, a.workspace.id),
    eq(tasks.ownerEmail, a.ownerEmail),
    eq(tasks.orgId, a.orgId),
  );
}
function summary(row: typeof plans.$inferSelect) {
  return planSummarySchema.parse({
    ...row,
    urlPath: `/handover?workspaceId=${encodeURIComponent(row.workspaceId)}&planId=${encodeURIComponent(row.id)}`,
  });
}
export async function listPlans(
  input: { workspaceId?: string | undefined },
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const rows = await getDb()
    .select()
    .from(plans)
    .where(scope(a))
    .orderBy(desc(plans.updatedAt), asc(plans.id))
    .limit(101);
  return {
    workspaceId: a.workspace.id,
    plans: rows.slice(0, 100).map(summary),
    hasMore: rows.length > 100,
  };
}
export async function getPlan(
  input: { workspaceId?: string | undefined; id: string },
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const [row] = await getDb()
    .select()
    .from(plans)
    .where(and(scope(a), eq(plans.id, input.id)))
    .limit(1);
  if (!row)
    return planErrors.noWrite(
      "That plan could not be found.",
      "plan_not_found",
      { statusCode: 404 },
    );
  const savedTasks = await getDb()
    .select({ ...taskSummaryColumns, description: tasks.description })
    .from(tasks)
    .where(and(taskScope(a), eq(tasks.planId, row.id)))
    .orderBy(
      sql`CASE ${tasks.priority} WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
      asc(tasks.dueDate),
      asc(tasks.id),
    )
    .limit(101);
  return planSchema.parse({
    ...summary(row),
    tasks: savedTasks
      .slice(0, 100)
      .map((row) => ({
        ...projectTaskSummary(row),
        description: row.description,
      })),
    hasMore: savedTasks.length > 100,
  });
}
export async function draftPlan(
  input: z.infer<typeof draftPlanInput>,
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const person = a.saved.people.find((p) => p.id === input.personId);
  if (!person?.departureDate)
    return planErrors.noWrite(
      "Choose a departing person with a saved departure date.",
      "invalid_plan",
      { statusCode: 400 },
    );
  const ids = input.tasks.map((t) => t.findingId);
  if (new Set(ids).size !== ids.length)
    return planErrors.noWrite(
      "Include each finding once in the draft batch.",
      "invalid_plan",
      { statusCode: 400 },
    );
  for (const task of input.tasks)
    if (
      task.assigneeId &&
      !a.saved.people.some((p) => p.id === task.assigneeId)
    )
      return planErrors.noWrite(
        "Suggested owners must belong to this workspace.",
        "invalid_plan",
        { statusCode: 400 },
      );
  const now = new Date().toISOString();
  const result = await getDb().transaction(async (tx) => {
    const risks = await tx
      .select()
      .from(findings)
      .where(
        and(
          eq(findings.workspaceId, a.workspace.id),
          eq(findings.ownerEmail, a.ownerEmail),
          eq(findings.orgId, a.orgId),
          inArray(findings.id, ids),
        ),
      )
      .for("share");
    const sources = await tx
      .select()
      .from(findingEvidence)
      .where(
        and(
          eq(findingEvidence.workspaceId, a.workspace.id),
          eq(findingEvidence.ownerEmail, a.ownerEmail),
          eq(findingEvidence.orgId, a.orgId),
          inArray(findingEvidence.findingId, ids),
        ),
      )
      .orderBy(asc(findingEvidence.id));
    for (const id of ids) {
      const risk = risks.find((f) => f.id === id);
      if (
        !risk ||
        ["rejected", "resolved"].includes(risk.status) ||
        (risk.personId && risk.personId !== person.id) ||
        !sources.some((s) => s.findingId === id)
      )
        return planErrors.noWrite(
          "Use source-backed, unresolved findings relevant to this departure.",
          "invalid_plan",
          { statusCode: 400 },
        );
    }
    await tx
      .insert(plans)
      .values({
        id: randomUUID(),
        ownerEmail: a.ownerEmail,
        orgId: a.orgId,
        workspaceId: a.workspace.id,
        personId: person.id,
        personName: person.name,
        departureDate: person.departureDate!,
        status: "draft",
        revision: 0,
        reviewNotes: "",
        approvedBy: null,
        approvedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    const [plan] = await tx
      .select()
      .from(plans)
      .where(and(scope(a), eq(plans.personId, person.id)))
      .for("update");
    const existing = await tx
      .select({ findingId: tasks.findingId })
      .from(tasks)
      .where(and(taskScope(a), eq(tasks.planId, plan!.id)));
    const additions = input.tasks.filter(
      (t) => !existing.some((e) => e.findingId === t.findingId),
    );
    if (!additions.length) return { id: plan!.id, insertedCount: 0 };
    if (plan!.status !== "draft")
      return planErrors.noWrite(
        "Reopen the approved plan before adding proposed tasks.",
        "plan_conflict",
        { statusCode: 409 },
      );
    if (existing.length + additions.length > 100)
      return planErrors.noWrite(
        "A plan supports up to 100 tasks. Narrow the draft scope.",
        "invalid_plan",
        { statusCode: 400 },
      );
    await tx.insert(tasks).values(
      additions.map((t) => {
        const risk = risks.find((f) => f.id === t.findingId)!;
        const source = sources.find((s) => s.findingId === t.findingId)!;
        const assignee = a.saved.people.find((p) => p.id === t.assigneeId);
        return {
          id: randomUUID(),
          ownerEmail: a.ownerEmail,
          orgId: a.orgId,
          workspaceId: a.workspace.id,
          planId: plan!.id,
          findingId: risk.id,
          runId: null,
          stepNumber: null,
          documentId: source.documentId,
          sourceName: source.sourceName,
          instruction: risk.recommendedAction,
          gapNotes: `${risk.description}\n\n${risk.uncertainty}`,
          gapResult: null,
          title: t.title,
          description: t.description,
          priority: t.priority,
          assignmentStatus: "suggested",
          assigneeId: assignee?.id ?? null,
          assigneeName: assignee?.name ?? null,
          dueDate: t.dueDate,
          status: "todo",
          resolution: "",
          revision: 0,
          createdAt: now,
          updatedAt: now,
          recordedBy: a.ownerEmail,
        };
      }),
    );
    await tx
      .update(plans)
      .set({ revision: plan!.revision + 1, updatedAt: now })
      .where(and(scope(a), eq(plans.id, plan!.id)));
    await tx.insert(activityEvents).values({
      id: randomUUID(),
      ownerEmail: a.ownerEmail,
      orgId: a.orgId,
      workspaceId: a.workspace.id,
      actor: a.ownerEmail,
      eventType: "handover_plan_drafted",
      summary: `Proposed ${additions.length} source-linked handover tasks for ${person.name}.`,
      createdAt: now,
    });
    return { id: plan!.id, insertedCount: additions.length };
  });
  return {
    plan: await getPlan({ workspaceId: a.workspace.id, id: result.id }, ctx),
    insertedCount: result.insertedCount,
    _receipt: {
      changed: result.insertedCount > 0,
      verified: true,
      subject: result.id,
      summary: result.insertedCount
        ? `${result.insertedCount} proposed tasks saved and read back; assignments still require plan approval.`
        : "Existing tasks returned unchanged; no new assignments made.",
    },
  };
}
export async function reviewPlan(
  input: z.infer<typeof reviewPlanInput>,
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const now = new Date().toISOString();
  await getDb().transaction(async (tx) => {
    const [plan] = await tx
      .select()
      .from(plans)
      .where(and(scope(a), eq(plans.id, input.id)))
      .for("update");
    if (!plan)
      return planErrors.noWrite(
        "That plan could not be found.",
        "plan_not_found",
        { statusCode: 404 },
      );
    const expected = input.decision === "approve" ? "draft" : "approved";
    if (plan.revision !== input.revision || plan.status !== expected)
      return planErrors.noWrite(
        "The plan changed or this decision is no longer applicable. Refresh before reviewing.",
        "plan_conflict",
        { statusCode: 409 },
      );
    if (input.decision === "approve") {
      const [anyTask] = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(taskScope(a), eq(tasks.planId, plan.id)))
        .limit(1);
      if (!anyTask)
        return planErrors.noWrite(
          "Add at least one task before approving this plan.",
          "invalid_plan",
          { statusCode: 400 },
        );
      const proposed = await tx
        .select()
        .from(tasks)
        .where(
          and(
            taskScope(a),
            eq(tasks.planId, plan.id),
            eq(tasks.assignmentStatus, "suggested"),
          ),
        )
        .for("update");
      if (proposed.some((t) => !t.assigneeId || !t.dueDate))
        return planErrors.noWrite(
          "Every suggested task needs an owner and deadline before approval.",
          "invalid_plan",
          { statusCode: 400 },
        );
      await tx
        .update(tasks)
        .set({
          assignmentStatus: "confirmed",
          revision: sql`${tasks.revision}+1`,
          updatedAt: now,
          recordedBy: a.ownerEmail,
        })
        .where(
          and(
            taskScope(a),
            eq(tasks.planId, plan.id),
            eq(tasks.assignmentStatus, "suggested"),
          ),
        );
    }
    const [updated] = await tx
      .update(plans)
      .set({
        status: input.decision === "approve" ? "approved" : "draft",
        revision: plan.revision + 1,
        reviewNotes: input.notes,
        approvedBy:
          input.decision === "approve" ? a.ownerEmail : plan.approvedBy,
        approvedAt: input.decision === "approve" ? now : plan.approvedAt,
        updatedAt: now,
      })
      .where(
        and(
          scope(a),
          eq(plans.id, plan.id),
          eq(plans.revision, input.revision),
          eq(plans.status, expected),
        ),
      )
      .returning({ id: plans.id });
    if (!updated) throw new Error("Locked plan changed during review");
    await tx.insert(activityEvents).values({
      id: randomUUID(),
      ownerEmail: a.ownerEmail,
      orgId: a.orgId,
      workspaceId: a.workspace.id,
      actor: a.ownerEmail,
      eventType: "handover_plan_reviewed",
      summary: `${plan.personName} plan ${input.decision === "approve" ? "approved" : "reopened"}. ${input.notes}`,
      createdAt: now,
    });
  });
  return {
    plan: await getPlan(input, ctx),
    insertedCount: 0,
    _receipt: {
      changed: true,
      verified: true,
      subject: input.id,
      summary:
        input.decision === "approve"
          ? "Plan approved and read back; proposed assignments are now confirmed. Procedure readiness unchanged."
          : "Plan reopened for additions; previously confirmed assignments remain in place.",
    },
  };
}

export async function removePlanTask(
  input: {
    id: string;
    revision: number;
    reason: string;
    workspaceId?: string | undefined;
  },
  ctx?: ActionRunContext,
) {
  const a = await documentWorkspace(input.workspaceId, ctx);
  const [saved] = await getDb()
    .select()
    .from(tasks)
    .where(and(taskScope(a), eq(tasks.id, input.id)))
    .limit(1);
  if (!saved?.planId)
    return planErrors.noWrite(
      "Choose a proposed task from a departure plan.",
      "invalid_plan",
      { statusCode: 400 },
    );
  const now = new Date().toISOString();
  await getDb().transaction(async (tx) => {
    const [plan] = await tx
      .select()
      .from(plans)
      .where(and(scope(a), eq(plans.id, saved.planId!)))
      .for("update");
    if (!plan || plan.status !== "draft")
      return planErrors.noWrite(
        "Only suggestions in a draft plan can be removed.",
        "plan_conflict",
        { statusCode: 409 },
      );
    const [removed] = await tx
      .delete(tasks)
      .where(
        and(
          taskScope(a),
          eq(tasks.id, input.id),
          eq(tasks.revision, input.revision),
          eq(tasks.assignmentStatus, "suggested"),
          eq(tasks.status, "todo"),
        ),
      )
      .returning({ id: tasks.id });
    if (!removed)
      return planErrors.noWrite(
        "The suggestion changed or was already approved. Refresh before removing it.",
        "plan_conflict",
        { statusCode: 409 },
      );
    await tx
      .update(plans)
      .set({ revision: plan.revision + 1, updatedAt: now })
      .where(and(scope(a), eq(plans.id, plan.id)));
    await tx.insert(activityEvents).values({
      id: randomUUID(),
      ownerEmail: a.ownerEmail,
      orgId: a.orgId,
      workspaceId: a.workspace.id,
      actor: a.ownerEmail,
      eventType: "handover_suggestion_removed",
      summary: `Removed proposed task: ${saved.title}. ${input.reason}`,
      createdAt: now,
    });
  });
  return {
    plan: await getPlan({ workspaceId: a.workspace.id, id: saved.planId }, ctx),
    insertedCount: 0,
    _receipt: {
      changed: true,
      verified: true,
      subject: saved.planId,
      summary:
        "Suggestion removed; remaining plan read back. Confirmed assignments preserved.",
    },
  };
}
