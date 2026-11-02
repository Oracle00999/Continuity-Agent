import type { ActionRunContext } from "@agent-native/core/action";
import {
  and,
  asc,
  desc,
  eq,
  ne,
  inArray,
  sql,
  count,
  countDistinct,
  lt,
} from "drizzle-orm";
import { overviewSchema } from "../../shared/overview.js";
import { riskSummarySchema } from "../../shared/risks.js";
import { getDb } from "../db/index.js";
import {
  systems,
  findings,
  handoverTasks as tasks,
  relationships,
  verificationRuns as runs,
  activityEvents,
} from "../db/schema.js";
import { getWorkspaceContext } from "./workspace.js";
import { taskSummaryColumns, projectTaskSummary } from "./handover-tasks.js";
import { riskMachine } from "./risk-lifecycle.js";
import { verificationMachine } from "./verification-lifecycle.js";
import { activityPresentation } from "./overview-activity.js";
export function lagosCalendarDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
export async function getOverview(
  input: { workspaceId?: string | undefined },
  ctx?: ActionRunContext,
) {
  const context = await getWorkspaceContext(input, ctx);
  const now = new Date();
  const day = lagosCalendarDay(now);
  const empty = {
    workspace: context.workspace,
    asOf: now.toISOString(),
    calendarDay: day,
    departures: context.people.filter((p) => p.departureDate),
    metrics: {
      criticalSystems: 0,
      openRisks: 0,
      highPriorityRisks: 0,
      proposedRisks: 0,
      pendingAssignments: 0,
      overdueAssignments: 0,
      suggestedTasks: 0,
      ownershipCandidates: 0,
      runbooksWithResults: 0,
      latestPasses: 0,
      latestFailures: 0,
      latestGapped: 0,
      latestInProgress: 0,
    },
    topRisks: [],
    upcomingTasks: [],
    ownershipCandidates: [],
    latestTests: [],
    activity: [],
  };
  if (!context.workspace) return overviewSchema.parse(empty);
  const workspaceId = context.workspace.id;
  const ownerEmail = ctx!.userEmail!;
  const orgId = ctx?.orgId ?? "";
  const systemScope = and(
    eq(systems.workspaceId, workspaceId),
    eq(systems.ownerEmail, ownerEmail),
    eq(systems.orgId, orgId),
  );
  const riskScope = and(
    eq(findings.workspaceId, workspaceId),
    eq(findings.ownerEmail, ownerEmail),
    eq(findings.orgId, orgId),
  );
  const taskScope = and(
    eq(tasks.workspaceId, workspaceId),
    eq(tasks.ownerEmail, ownerEmail),
    eq(tasks.orgId, orgId),
  );
  const relationshipScope = and(
    eq(relationships.workspaceId, workspaceId),
    eq(relationships.ownerEmail, ownerEmail),
    eq(relationships.orgId, orgId),
  );
  const runScope = and(
    eq(runs.workspaceId, workspaceId),
    eq(runs.ownerEmail, ownerEmail),
    eq(runs.orgId, orgId),
  );
  const snapshot = await getDb().transaction(
    async (tx) => {
      const latest = tx
        .selectDistinctOn([runs.documentId], {
          id: runs.id,
          documentId: runs.documentId,
          sourceName: runs.sourceName,
          testerName: runs.testerName,
          status: runs.status,
          createdAt: runs.createdAt,
        })
        .from(runs)
        .where(runScope)
        .orderBy(asc(runs.documentId), desc(runs.createdAt), desc(runs.id))
        .as("latest_attempts");
      const owners = tx
        .select({
          kind: relationships.targetKind,
          targetId:
            sql<string>`coalesce(${relationships.systemId},${relationships.processId})`.as(
              "target_id",
            ),
          name: sql<string>`min(${relationships.targetName})`.as("target_name"),
          personId: sql<string>`min(${relationships.personId})`.as("person_id"),
          personName: sql<string>`min(${relationships.personName})`.as(
            "person_name",
          ),
        })
        .from(relationships)
        .where(
          and(
            relationshipScope,
            eq(relationships.relationship, "owns"),
            ne(relationships.status, "rejected"),
          ),
        )
        .groupBy(
          relationships.targetKind,
          relationships.systemId,
          relationships.processId,
        )
        .having(eq(countDistinct(relationships.personId), 1))
        .as("owner_candidates");
      const openRisk = and(
        riskScope,
        inArray(findings.status, ["proposed", "accepted"]),
      );
      const pendingTask = and(
        taskScope,
        eq(tasks.assignmentStatus, "confirmed"),
        ne(tasks.status, "done"),
      );
      const [
        critical,
        riskCounts,
        taskCounts,
        testCounts,
        ownerCounts,
        risks,
        due,
        concentrations,
        latestTests,
        activity,
      ] = await Promise.all([
        tx
          .select({ value: count() })
          .from(systems)
          .where(and(systemScope, eq(systems.criticality, "critical"))),
        tx
          .select({
            total: count(),
            high: sql<number>`count(*) filter (where ${findings.severity} in ('critical','high'))`.mapWith(
              Number,
            ),
            proposed:
              sql<number>`count(*) filter (where ${findings.status}='proposed')`.mapWith(
                Number,
              ),
          })
          .from(findings)
          .where(openRisk),
        tx
          .select({
            pending:
              sql<number>`count(*) filter (where ${tasks.assignmentStatus}='confirmed' and ${tasks.status}<>'done')`.mapWith(
                Number,
              ),
            overdue:
              sql<number>`count(*) filter (where ${tasks.assignmentStatus}='confirmed' and ${tasks.status}<>'done' and ${tasks.dueDate}<${day})`.mapWith(
                Number,
              ),
            suggested:
              sql<number>`count(*) filter (where ${tasks.assignmentStatus}='suggested')`.mapWith(
                Number,
              ),
          })
          .from(tasks)
          .where(taskScope),
        tx
          .select({
            finalized:
              sql<number>`count(*) filter (where ${latest.status}<>'open')`.mapWith(
                Number,
              ),
            passed:
              sql<number>`count(*) filter (where ${latest.status}='passed')`.mapWith(
                Number,
              ),
            failed:
              sql<number>`count(*) filter (where ${latest.status}='failed')`.mapWith(
                Number,
              ),
            gapped:
              sql<number>`count(*) filter (where ${latest.status}='passed_with_gaps')`.mapWith(
                Number,
              ),
            open: sql<number>`count(*) filter (where ${latest.status}='open')`.mapWith(
              Number,
            ),
          })
          .from(latest),
        tx.select({ value: count() }).from(owners),
        tx
          .select({
            id: findings.id,
            workspaceId: findings.workspaceId,
            key: findings.key,
            type: findings.type,
            title: findings.title,
            severity: findings.severity,
            status: findings.status,
            personId: findings.personId,
            personName: findings.personName,
            systemId: findings.systemId,
            systemName: findings.systemName,
            processId: findings.processId,
            processName: findings.processName,
            runId: findings.runId,
            revision: findings.revision,
            createdAt: findings.createdAt,
            updatedAt: findings.updatedAt,
          })
          .from(findings)
          .where(openRisk)
          .orderBy(
            sql`CASE ${findings.severity} WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
            desc(findings.createdAt),
            asc(findings.id),
          )
          .limit(5),
        tx
          .select(taskSummaryColumns)
          .from(tasks)
          .where(pendingTask)
          .orderBy(asc(tasks.dueDate), asc(tasks.id))
          .limit(5),
        tx.select().from(owners).orderBy(asc(owners.name)).limit(5),
        tx
          .select()
          .from(latest)
          .orderBy(desc(latest.createdAt), desc(latest.id))
          .limit(6),
        tx
          .select({
            id: activityEvents.id,
            eventType: activityEvents.eventType,
            summary: activityEvents.summary,
            createdAt: activityEvents.createdAt,
          })
          .from(activityEvents)
          .where(
            and(
              eq(activityEvents.workspaceId, workspaceId),
              eq(activityEvents.ownerEmail, ownerEmail),
              eq(activityEvents.orgId, orgId),
            ),
          )
          .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id))
          .limit(10),
      ]);
      const ws = encodeURIComponent(workspaceId);
      return {
        metrics: {
          criticalSystems: critical[0]!.value,
          openRisks: riskCounts[0]!.total,
          highPriorityRisks: riskCounts[0]!.high,
          proposedRisks: riskCounts[0]!.proposed,
          pendingAssignments: taskCounts[0]!.pending,
          overdueAssignments: taskCounts[0]!.overdue,
          suggestedTasks: taskCounts[0]!.suggested,
          ownershipCandidates: ownerCounts[0]!.value,
          runbooksWithResults: testCounts[0]!.finalized,
          latestPasses: testCounts[0]!.passed,
          latestFailures: testCounts[0]!.failed,
          latestGapped: testCounts[0]!.gapped,
          latestInProgress: testCounts[0]!.open,
        },
        topRisks: risks.map((row) =>
          riskSummarySchema.parse({
            ...row,
            status: riskMachine.parseState(row.status),
            urlPath: `/risks?workspaceId=${ws}&findingId=${encodeURIComponent(row.id)}&personId=all`,
          }),
        ),
        upcomingTasks: due.map(projectTaskSummary),
        ownershipCandidates: concentrations.map((row) => ({
          name: row.name,
          kind: row.kind,
          personName: row.personName,
          urlPath: `/knowledge-map?workspaceId=${ws}&personId=${encodeURIComponent(row.personId)}`,
        })),
        latestTests: latestTests.map((row) => ({
          ...row,
          status: verificationMachine.parseState(row.status),
          urlPath: `/verification?workspaceId=${ws}&runId=${encodeURIComponent(row.id)}`,
        })),
        activity: activity.map((row) => {
          const presentation = activityPresentation(row);
          return {
            id: row.id,
            kind: presentation.kind,
            detail: presentation.detail,
            createdAt: row.createdAt,
            urlPath: `${presentation.path}?workspaceId=${ws}`,
          };
        }),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  return overviewSchema.parse({ ...empty, ...snapshot });
}
