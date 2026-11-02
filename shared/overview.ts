import { z } from "zod";
import { workspaceSchema, personSchema } from "./workspace.js";
import { riskSummarySchema } from "./risks.js";
import { taskSummarySchema } from "./handover-tasks.js";
export const activityKindSchema = z.enum([
  "workspace_loaded",
  "document_saved",
  "knowledge_saved",
  "knowledge_reviewed",
  "risks_proposed",
  "risk_reviewed",
  "test_started",
  "test_results",
  "test_finalized",
  "tasks_created",
  "task_updated",
  "plan_drafted",
  "plan_approved",
  "plan_reopened",
  "suggestion_removed",
  "updated",
]);
export const overviewSchema = z.object({
  workspace: workspaceSchema.nullable(),
  asOf: z.string(),
  calendarDay: z.string(),
  departures: z.array(personSchema),
  metrics: z.object({
    criticalSystems: z.number().int(),
    openRisks: z.number().int(),
    highPriorityRisks: z.number().int(),
    proposedRisks: z.number().int(),
    pendingAssignments: z.number().int(),
    overdueAssignments: z.number().int(),
    suggestedTasks: z.number().int(),
    ownershipCandidates: z.number().int(),
    runbooksWithResults: z.number().int(),
    latestPasses: z.number().int(),
    latestFailures: z.number().int(),
    latestGapped: z.number().int(),
    latestInProgress: z.number().int(),
  }),
  topRisks: z.array(riskSummarySchema),
  upcomingTasks: z.array(taskSummarySchema),
  ownershipCandidates: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(["system", "process"]),
      personName: z.string(),
      urlPath: z.string(),
    }),
  ),
  latestTests: z.array(
    z.object({
      id: z.string(),
      documentId: z.string(),
      sourceName: z.string(),
      testerName: z.string(),
      status: z.enum(["open", "passed", "passed_with_gaps", "failed"]),
      createdAt: z.string(),
      urlPath: z.string(),
    }),
  ),
  activity: z.array(
    z.object({
      id: z.string(),
      kind: activityKindSchema,
      detail: z.string().nullable(),
      createdAt: z.string(),
      urlPath: z.string(),
    }),
  ),
});
export type Overview = z.infer<typeof overviewSchema>;
