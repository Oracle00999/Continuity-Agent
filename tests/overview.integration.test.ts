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
import { saveKnowledge, reviewKnowledge } from "../server/domain/knowledge";
import { draftPlan } from "../server/domain/handover-plans";
import { getOverview, lagosCalendarDay } from "../server/domain/overview";
import { activityPresentation } from "../server/domain/overview-activity";
import { eq, count } from "drizzle-orm";
const ctx: ActionRunContext = {
  caller: "frontend",
  userEmail: "overview-qa@example.invalid",
  orgId: "isolated-overview-tests",
};
let client: PGlite;
let workspaceId: string;
let docId: string;
let alexId: string;
let mayaId: string;
let ownerReviewId: string;
const stamp = "2020-01-01T12:00:00Z";
beforeAll(async () => {
  client = new PGlite();
  await client.waitReady;
  state.db = drizzle(client, { schema });
  for (const migration of state.migrations) {
    const sql =
      typeof migration.sql === "string"
        ? migration.sql
        : migration.sql.postgres;
    if (sql) await client.exec(sql);
  }
  const data = await initializeDemoWorkspace(ctx);
  workspaceId = data.workspace!.id;
  alexId = data.people.find((p) => p.name === "Alex Morgan")!.id;
  mayaId = data.people.find((p) => p.name === "Maya Chen")!.id;
  const priya = data.people.find((p) => p.name === "Priya Shah")!;
  const api = data.systems.find((s) => s.name === "Production API")!;
  const db = data.systems.find((s) => s.name === "PostgreSQL database")!;
  const monitoring = data.systems.find(
    (s) => s.name === "Monitoring and alerting",
  )!;
  docId = crypto.randomUUID();
  const passageId = crypto.randomUUID();
  const text =
    "Alex Morgan and Maya Chen own Production API recovery together. Alex Morgan owns the PostgreSQL database backup schedule. Priya Shah owns Monitoring and alerting.\n\n1. Confirm an approved target.\n2. Retrieve the approved backup.";
  const tenant = { ownerEmail: ctx.userEmail!, orgId: ctx.orgId!, workspaceId };
  const document = (id: string) => ({
    id,
    ...tenant,
    filename: "Overview QA source.md",
    mimeType: "text/markdown",
    storageKey: null,
    contentHash: id,
    source: "demo" as const,
    status: "ready" as const,
    extractedText: text,
    byteSize: text.length,
    uploadedAt: stamp,
    passageCount: 1,
    warnings: [],
  });
  await state.db
    .insert(schema.documents)
    .values([
      document(docId),
      document("qa-gapped-doc"),
      document("qa-failed-doc"),
    ]);
  await state.db
    .insert(schema.evidence)
    .values({
      id: passageId,
      ...tenant,
      documentId: docId,
      quote: text,
      section: null,
      pageNumber: null,
      startOffset: 0,
      endOffset: text.length,
      mentions: [],
    });
  const claims = await saveKnowledge(
    {
      workspaceId,
      documentId: docId,
      claims: [
        {
          personId: alexId,
          relationship: "owns",
          target: { kind: "system", id: api.id },
          evidenceId: passageId,
          quote: text,
          confidence: 0.9,
        },
        {
          personId: mayaId,
          relationship: "owns",
          target: { kind: "system", id: api.id },
          evidenceId: passageId,
          quote: text,
          confidence: 0.9,
        },
        {
          personId: alexId,
          relationship: "owns",
          target: { kind: "system", id: db.id },
          evidenceId: passageId,
          quote: text,
          confidence: 0.9,
        },
        {
          personId: priya.id,
          relationship: "owns",
          target: { kind: "system", id: monitoring.id },
          evidenceId: passageId,
          quote: text,
          confidence: 0.9,
        },
      ],
    },
    ctx,
  );
  const rejected = claims.claims.find((c) => c.targetId === monitoring.id)!;
  ownerReviewId = claims.claims.find((c) => c.targetId === db.id)!.id;
  await reviewKnowledge(
    {
      workspaceId,
      id: rejected.id,
      revision: 0,
      status: "rejected",
      notes: "Isolated QA: exclude this candidate.",
    },
    ctx,
  );
  const riskRows = Array.from({ length: 132 }, (_, i) => ({
    id: `qa-risk-${i}`,
    ...tenant,
    key: `qa-risk-${i}`,
    type: "documentation_gap",
    title: `QA finding ${i}`,
    description: "An isolated source-backed fixture assessment.",
    severity: i === 128 || i === 130 ? "critical" : i === 129 ? "low" : "high",
    severityReason: "This QA example represents a recovery documentation gap.",
    confidence: 0.8,
    uncertainty: "Other sources may contain the missing approved instructions.",
    recommendedAction: "Clarify the approved recovery instructions and retest.",
    status:
      i === 130
        ? "rejected"
        : i === 131
          ? "resolved"
          : i >= 128
            ? "accepted"
            : "proposed",
    personId: alexId,
    personName: "Alex Morgan",
    systemId: db.id,
    systemName: db.name,
    processId: null,
    processName: null,
    runId: null,
    verificationSnapshot: null,
    reviewNotes: "",
    reviewedBy: null,
    revision: 0,
    createdAt: stamp,
    updatedAt: stamp,
  }));
  await state.db.insert(schema.findings).values(riskRows);
  await state.db
    .insert(schema.findingEvidence)
    .values(
      riskRows.map((r) => ({
        id: crypto.randomUUID(),
        ...tenant,
        findingId: r.id,
        evidenceId: passageId,
        documentId: docId,
        sourceName: "Overview QA source.md",
        quote: text,
      })),
    );
  await draftPlan(
    {
      workspaceId,
      personId: alexId,
      tasks: [
        {
          findingId: "qa-risk-0",
          title: "Suggested overdue example",
          description:
            "A proposed task must not inflate confirmed or overdue counts.",
          priority: "high",
          assigneeId: alexId,
          dueDate: "2000-01-01",
        },
        {
          findingId: "qa-risk-1",
          title: "Unassigned example",
          description: "This proposed task still needs an owner and deadline.",
          priority: "medium",
          assigneeId: null,
          dueDate: null,
        },
      ],
    },
    ctx,
  );
  const run = (
    id: string,
    documentId: string,
    status: string,
    createdAt: string,
  ) => ({
    id,
    ...tenant,
    documentId,
    sourceName: "Overview QA source.md",
    sourceHash: documentId,
    testerId: mayaId,
    testerName: "Maya Chen",
    requestId: id,
    status,
    steps: [],
    summary: "Isolated QA report only; no execution performed.",
    revision: 0,
    createdAt,
    updatedAt: createdAt,
    recordedBy: ctx.userEmail!,
  });
  await state.db
    .insert(schema.verificationRuns)
    .values([
      run("old-pass", docId, "passed", "2019-01-01T12:00:00Z"),
      run("new-pass", docId, "passed", "2020-01-01T12:00:00Z"),
    ]);
  const task = (
    id: string,
    runId: string,
    stepNumber: number,
    status: string,
    dueDate: string,
  ) => ({
    id,
    ...tenant,
    runId,
    stepNumber,
    planId: null,
    findingId: null,
    documentId: docId,
    sourceName: "Overview QA source.md",
    instruction: "Retrieve the approved backup.",
    gapNotes: "Isolated historic QA gap snapshot.",
    gapResult: "blocked",
    title: id,
    description: "",
    priority: "medium",
    assignmentStatus: "confirmed",
    assigneeId: alexId,
    assigneeName: "Alex Morgan",
    dueDate,
    status,
    resolution: status === "done" ? "QA fixture resolved." : "",
    revision: 0,
    createdAt: stamp,
    updatedAt: stamp,
    recordedBy: ctx.userEmail!,
  });
  await state.db
    .insert(schema.handoverTasks)
    .values([
      task("overdue-confirmed", "old-pass", 1, "todo", "2000-01-01"),
      task("completed-confirmed", "old-pass", 2, "done", "2000-01-01"),
      task("future-confirmed", "new-pass", 1, "in_progress", "2099-01-01"),
    ]);
}, 30000);
afterAll(async () => client?.close());
describe("Overview real SQL snapshot", () => {
  it("counts all rows beyond list limits, separates suggestions and excludes resolved/rejected findings", async () => {
    const result = await getOverview({ workspaceId }, ctx);
    expect(result.metrics.openRisks).toBe(130);
    expect(result.metrics.highPriorityRisks).toBe(129);
    expect(result.metrics.proposedRisks).toBe(128);
    expect(result.topRisks).toHaveLength(5);
    expect(result.topRisks[0].id).toBe("qa-risk-128");
    expect(result.metrics.pendingAssignments).toBe(2);
    expect(result.metrics.overdueAssignments).toBe(1);
    expect(result.metrics.suggestedTasks).toBe(2);
    expect(result.upcomingTasks.map((t) => t.id)).toEqual([
      "overdue-confirmed",
      "future-confirmed",
    ]);
    expect(result.metrics.ownershipCandidates).toBe(1);
    expect(result.ownershipCandidates[0].name).toBe("PostgreSQL database");
    expect(result.metrics.latestPasses).toBe(1);
    expect(result.metrics.runbooksWithResults).toBe(1);
    expect(result.latestTests).toHaveLength(1);
  });
  it("uses the latest attempt per runbook instead of inheriting an older pass", async () => {
    const base = {
      ownerEmail: ctx.userEmail!,
      orgId: ctx.orgId!,
      workspaceId,
      sourceName: "QA attempt",
      sourceHash: docId,
      testerId: mayaId,
      testerName: "Maya Chen",
      steps: [],
      summary: "QA fixture only.",
      revision: 0,
      recordedBy: ctx.userEmail!,
    };
    await state.db.insert(schema.verificationRuns).values([
      {
        ...base,
        id: "new-retest",
        requestId: "new-retest",
        documentId: docId,
        status: "open",
        createdAt: "2021-01-01T12:00:00Z",
        updatedAt: "2021-01-01T12:00:00Z",
      },
      {
        ...base,
        id: "gapped",
        requestId: "gapped",
        documentId: "qa-gapped-doc",
        status: "passed_with_gaps",
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        ...base,
        id: "failed",
        requestId: "failed",
        documentId: "qa-failed-doc",
        status: "failed",
        createdAt: stamp,
        updatedAt: stamp,
      },
    ]);
    const before = (
      await state.db.select({ value: count() }).from(schema.activityEvents)
    )[0].value;
    const result = await getOverview({ workspaceId }, ctx);
    expect(result.metrics.latestPasses).toBe(0);
    expect(result.metrics.latestInProgress).toBe(1);
    expect(result.metrics.latestFailures).toBe(1);
    expect(result.metrics.latestGapped).toBe(1);
    expect(result.metrics.runbooksWithResults).toBe(2);
    expect(result.latestTests).toHaveLength(3);
    expect(result.latestTests.find((t) => t.documentId === docId)?.id).toBe(
      "new-retest",
    );
    expect(
      (await state.db.select({ value: count() }).from(schema.activityEvents))[0]
        .value,
    ).toBe(before);
  });
  it("reflects human review and enforces owner/org/workspace scope", async () => {
    const claim = (
      await state.db
        .select()
        .from(schema.relationships)
        .where(eq(schema.relationships.id, ownerReviewId))
    )[0];
    await reviewKnowledge(
      {
        workspaceId,
        id: claim.id,
        revision: claim.revision,
        status: "rejected",
        notes: "QA rejection removes the ownership candidate.",
      },
      ctx,
    );
    expect(
      (await getOverview({ workspaceId }, ctx)).metrics.ownershipCandidates,
    ).toBe(0);
    await expect(
      getOverview(
        { workspaceId },
        { ...ctx, userEmail: "other@example.invalid" },
      ),
    ).rejects.toThrow(/Workspace not found/);
    await expect(
      getOverview({ workspaceId }, { ...ctx, orgId: "other-org" }),
    ).rejects.toThrow(/Workspace not found/);
    await expect(getOverview({ workspaceId })).rejects.toThrow(/Sign in/);
    const empty = await getOverview(
      {},
      { ...ctx, userEmail: "new-owner@example.invalid" },
    );
    expect(empty.workspace).toBeNull();
    expect(empty.metrics.openRisks).toBe(0);
    expect(empty.activity).toEqual([]);
  });
});
describe("Overview activity and calendar presentation", () => {
  it("uses the Lagos calendar day for deadlines", () => {
    expect(lagosCalendarDay(new Date("2026-10-31T23:30:00Z"))).toBe(
      "2026-11-01",
    );
  });
  it("keeps review notes, raw statuses and IDs out of activity titles", () => {
    expect(
      activityPresentation({
        eventType: "risk_reviewed",
        summary:
          "Backup location missing: accepted. Reviewer note: documentId=private-secret",
      }),
    ).toEqual({
      kind: "risk_reviewed",
      path: "/risks",
      detail: "Backup location missing",
    });
    expect(
      activityPresentation({
        eventType: "handover_plan_reviewed",
        summary: "Alex Morgan plan approved. private reviewer note",
      }),
    ).toEqual({
      kind: "plan_approved",
      path: "/handover",
      detail: "Alex Morgan",
    });
    expect(
      activityPresentation({
        eventType: "unknown",
        summary: "private raw metadata",
      }).detail,
    ).toBeNull();
  });
});
