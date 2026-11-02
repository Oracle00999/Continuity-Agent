import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import type { ActionRunContext } from "@agent-native/core/action";
import type { MigrationEntry } from "@agent-native/core/db";
const state = vi.hoisted(() => ({
  db: undefined as unknown as PgliteDatabase<
    typeof import("../server/db/schema")
  >,
  migrations: [] as MigrationEntry[],
}));
vi.mock("../server/db/index.js", () => ({ getDb: () => state.db }));
vi.mock("@agent-native/core/db", async (original) => {
  const actual = await original<typeof import("@agent-native/core/db")>();
  return {
    ...actual,
    runMigrations: (entries: MigrationEntry[], options: { table: string }) => {
      if (options.table === "continuity_migrations") state.migrations = entries;
      return async () => {};
    },
  };
});
import "../server/plugins/db";
import * as schema from "../server/db/schema";
import { initializeDemoWorkspace } from "../server/domain/workspace";
import { loadDemoDocuments, getDocument } from "../server/domain/documents";
import { saveRisks, getRisk } from "../server/domain/risks";
import {
  draftPlan,
  getPlan,
  listPlans,
  reviewPlan,
  removePlanTask,
} from "../server/domain/handover-plans";
import {
  getTask,
  updateTask,
  createTasks,
  listTasks,
} from "../server/domain/handover-tasks";
import {
  startVerification,
  updateVerification,
  getVerification,
} from "../server/domain/verification";
import { draftPlanInput } from "../shared/handover-plans";
const ctx: ActionRunContext = {
  caller: "frontend",
  userEmail: "plan-qa@example.invalid",
  orgId: "isolated-plan-tests",
};
let client: PGlite;
let workspaceId: string;
let alexId: string;
let mayaId: string;
let documentId: string;
let findingIds: string[];
let testRunId: string;
beforeAll(async () => {
  client = new PGlite();
  state.db = drizzle(client, { schema });
  await client.waitReady;
  for (const migration of state.migrations) {
    const sql =
      typeof migration.sql === "string"
        ? migration.sql
        : migration.sql.postgres;
    if (sql) await client.exec(sql);
  }
  const context = await initializeDemoWorkspace(ctx);
  workspaceId = context.workspace!.id;
  alexId = context.people.find((p) => p.name === "Alex Morgan")!.id;
  mayaId = context.people.find((p) => p.name === "Maya Chen")!.id;
  const seeded = await loadDemoDocuments({ workspaceId }, ctx);
  documentId = seeded.documents.find(
    (d) => d.filename === "Database Backup & Restore.md",
  )!.id;
  const doc = await getDocument({ workspaceId, id: documentId }, ctx);
  const passage = doc.evidence.find((e) =>
    e.quote.includes("Retrieve the latest completed nightly dump"),
  )!;
  const saved = await saveRisks(
    {
      workspaceId,
      findings: [1, 2, 3].map((n) => ({
        key: `isolated-plan-risk-${n}`,
        type: "documentation_gap" as const,
        title: `QA recovery gap ${n}`,
        description:
          "A fictional QA assessment of a missing backup retrieval detail.",
        severity: "high" as const,
        severityReason:
          "A missing retrieval detail can block a recovery attempt.",
        confidence: 0.8,
        uncertainty:
          "The required detail may exist in another approved source.",
        recommendedAction:
          "Clarify the approved recovery instructions and retest them.",
        personId: alexId,
        evidence: [{ evidenceId: passage.id, quote: passage.quote }],
      })),
    },
    ctx,
  );
  findingIds = saved.findings
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((f) => f.id);
  const run = await startVerification(
    {
      workspaceId,
      documentId,
      testerId: mayaId,
      requestId: crypto.randomUUID(),
    },
    ctx,
  );
  const report = await updateVerification(
    {
      workspaceId,
      id: run.run.id,
      revision: 0,
      results: [
        {
          number: 2,
          result: "blocked",
          notes:
            "Isolated QA only: sample backup location unclear; no restore performed.",
        },
      ],
    },
    ctx,
  );
  testRunId = report.run.id;
}, 30000);
afterAll(async () => {
  await client?.close();
});
const proposal = (findingId: string, assigned = false) => ({
  findingId,
  title: "Clarify recovery instructions",
  description:
    "Document the missing approved retrieval detail and arrange a human retest.",
  priority: "high" as const,
  assigneeId: assigned ? alexId : null,
  dueDate: assigned ? "2026-11-05" : null,
});
describe("departure plans with real isolated SQL migrations", () => {
  it("atomically drafts, edits, approves, reopens and removes suggestions without changing risks/tests", async () => {
    const input = draftPlanInput.parse({
      workspaceId,
      personId: alexId,
      tasks: [proposal(findingIds[0]), proposal(findingIds[1], true)],
    });
    const created = await Promise.all([
      draftPlan(input, ctx),
      draftPlan(input, ctx),
    ]);
    expect(created.map((r) => r.insertedCount).sort()).toEqual([0, 2]);
    let plan = await getPlan({ workspaceId, id: created[0].plan.id }, ctx);
    expect(plan.status).toBe("draft");
    expect(plan.tasks).toHaveLength(2);
    expect(plan.tasks.every((t) => t.assignmentStatus === "suggested")).toBe(
      true,
    );
    let task = await getTask(
      {
        workspaceId,
        id: plan.tasks.find((t) => t.findingId === findingIds[0])!.id,
      },
      ctx,
    );
    expect(task.findingUrlPath).toContain(findingIds[0]);
    expect(task.planId).toBe(plan.id);
    expect(task.runId).toBeNull();
    expect(task.description).toContain("human retest");
    const edit = () => ({
      workspaceId,
      id: task.id,
      revision: task.revision,
      title: task.title,
      description: task.description,
      priority: task.priority,
      assigneeId: task.assigneeId,
      dueDate: task.dueDate,
      status: "todo" as const,
      resolution: "",
    });
    await expect(
      updateTask({ ...edit(), status: "in_progress" }, ctx),
    ).rejects.toThrow(/Approve the plan/);
    await expect(
      reviewPlan(
        {
          workspaceId,
          id: plan.id,
          revision: plan.revision,
          decision: "approve",
          notes: "Isolated QA approval attempt.",
        },
        ctx,
      ),
    ).rejects.toThrow(/owner and deadline/);
    const originalPlanRevision = plan.revision;
    task = (
      await updateTask(
        {
          ...edit(),
          assigneeId: mayaId,
          dueDate: "2026-11-05",
          priority: "critical",
        },
        ctx,
      )
    ).task;
    plan = await getPlan({ workspaceId, id: plan.id }, ctx);
    expect(plan.revision).toBeGreaterThan(originalPlanRevision);
    await expect(
      reviewPlan(
        {
          workspaceId,
          id: plan.id,
          revision: originalPlanRevision,
          decision: "approve",
          notes: "Isolated stale review.",
        },
        ctx,
      ),
    ).rejects.toThrow(/changed/);
    const repeated = await draftPlan(input, ctx);
    expect(repeated.insertedCount).toBe(0);
    expect((await getTask({ workspaceId, id: task.id }, ctx)).priority).toBe(
      "critical",
    );
    // The parent lock and task revision prevent approval racing with owner removal.
    const competing = await Promise.allSettled([
      reviewPlan(
        {
          workspaceId,
          id: plan.id,
          revision: plan.revision,
          decision: "approve",
          notes: "Isolated QA approval; no real team commitment.",
        },
        ctx,
      ),
      updateTask({ ...edit(), assigneeId: null, dueDate: null }, ctx),
    ]);
    expect(competing.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    plan = await getPlan({ workspaceId, id: plan.id }, ctx);
    task = await getTask({ workspaceId, id: task.id }, ctx);
    if (plan.status === "draft") {
      task = (
        await updateTask(
          { ...edit(), assigneeId: mayaId, dueDate: "2026-11-05" },
          ctx,
        )
      ).task;
      plan = await getPlan({ workspaceId, id: plan.id }, ctx);
      plan = (
        await reviewPlan(
          {
            workspaceId,
            id: plan.id,
            revision: plan.revision,
            decision: "approve",
            notes: "Isolated QA approval after completing assignments.",
          },
          ctx,
        )
      ).plan;
    }
    expect(plan.status).toBe("approved");
    expect(plan.tasks.every((t) => t.assignmentStatus === "confirmed")).toBe(
      true,
    );
    task = await getTask({ workspaceId, id: task.id }, ctx);
    await expect(
      updateTask({ ...edit(), assigneeId: null }, ctx),
    ).rejects.toThrow(/Confirmed assignments need/);
    await expect(
      draftPlan(
        draftPlanInput.parse({
          workspaceId,
          personId: alexId,
          tasks: [proposal(findingIds[2], true)],
        }),
        ctx,
      ),
    ).rejects.toThrow(/Reopen/);
    const beforeRisk = await getRisk({ workspaceId, id: findingIds[0] }, ctx);
    const beforeRun = await getVerification(
      { workspaceId, id: testRunId },
      ctx,
    );
    plan = (
      await reviewPlan(
        {
          workspaceId,
          id: plan.id,
          revision: plan.revision,
          decision: "reopen",
          notes: "Isolated QA reopening for an extra proposal.",
        },
        ctx,
      )
    ).plan;
    expect(plan.tasks.every((t) => t.assignmentStatus === "confirmed")).toBe(
      true,
    );
    const addition = await draftPlan(
      draftPlanInput.parse({
        workspaceId,
        personId: alexId,
        tasks: [proposal(findingIds[2])],
      }),
      ctx,
    );
    expect(addition.insertedCount).toBe(1);
    const extra = addition.plan.tasks.find(
      (t) => t.findingId === findingIds[2],
    )!;
    await expect(
      removePlanTask(
        {
          workspaceId,
          id: task.id,
          revision: task.revision,
          reason: "QA attempt to remove confirmed task",
        },
        ctx,
      ),
    ).rejects.toThrow(/approved|changed/);
    const removed = await removePlanTask(
      {
        workspaceId,
        id: extra.id,
        revision: extra.revision,
        reason: "QA unwanted suggestion removed",
      },
      ctx,
    );
    expect(removed.plan.tasks.some((t) => t.id === extra.id)).toBe(false);
    expect(await getRisk({ workspaceId, id: findingIds[0] }, ctx)).toEqual(
      beforeRisk,
    );
    expect(await getVerification({ workspaceId, id: testRunId }, ctx)).toEqual(
      beforeRun,
    );
    const legacy = await createTasks(
      {
        workspaceId,
        runId: testRunId,
        sourceRevision: beforeRun.revision,
        tasks: [
          {
            stepNumber: 2,
            title: "Existing verification-gap task",
            assigneeId: alexId,
            dueDate: "2026-11-05",
          },
        ],
      },
      ctx,
    );
    expect(legacy.tasks[0].assignmentStatus).toBe("confirmed");
    expect(legacy.tasks[0].planId).toBeNull();
    expect(legacy.tasks[0].runId).toBe(testRunId);
    expect(
      (await listTasks({ workspaceId }, ctx)).tasks.some(
        (t) => t.id === task.id,
      ),
    ).toBe(true);
  }, 30000);
  it("rejects foreign scope and invalid references without partial drafts", async () => {
    expect((await listPlans({ workspaceId }, ctx)).plans).toHaveLength(1);
    await expect(getPlan({ workspaceId, id: "missing" }, ctx)).rejects.toThrow(
      /could not be found/,
    );
    const id = (await listPlans({ workspaceId }, ctx)).plans[0].id;
    await expect(
      getPlan(
        { workspaceId, id },
        { ...ctx, userEmail: "another-owner@example.invalid" },
      ),
    ).rejects.toThrow(/Workspace not found/);
    await expect(
      getPlan({ workspaceId, id }, { ...ctx, orgId: "another-org" }),
    ).rejects.toThrow(/Workspace not found/);
    await expect(
      draftPlan(
        draftPlanInput.parse({
          workspaceId,
          personId: alexId,
          tasks: [proposal("foreign-risk")],
        }),
        ctx,
      ),
    ).rejects.toThrow(/source-backed/);
    await expect(
      draftPlan(
        draftPlanInput.parse({
          workspaceId,
          personId: mayaId,
          tasks: [proposal(findingIds[0])],
        }),
        ctx,
      ),
    ).rejects.toThrow(/departing person/);
    expect((await listPlans({ workspaceId }, ctx)).plans).toHaveLength(1);
  });
});
