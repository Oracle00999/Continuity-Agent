import { getOverview } from "../server/domain/overview.js";
import { overviewSchema } from "../shared/overview.js";
import {
  listPlans,
  getPlan,
  planErrors,
} from "../server/domain/handover-plans.js";
import { planListSchema, planSchema } from "../shared/handover-plans.js";
import { listRisks, getRisk } from "../server/domain/risks.js";
import {
  riskListSchema,
  riskSchema,
  riskStatusSchema,
} from "../shared/risks.js";
import { getKnowledgeMap } from "../server/domain/knowledge-map.js";
import { knowledgeMapSchema } from "../shared/knowledge-map.js";
import { listKnowledge } from "../server/domain/knowledge.js";
import { knowledgeListSchema } from "../shared/knowledge.js";
import { listTasks, getTask } from "../server/domain/handover-tasks.js";
import { tasksListSchema, taskSchema } from "../shared/handover-tasks.js";
import { defineAction } from "@agent-native/core/action";
import { readAppState } from "@agent-native/core/application-state";
import { z } from "zod";

import { getDocument, listDocuments } from "../server/domain/documents.js";
import { getWorkspaceContext } from "../server/domain/workspace.js";
import {
  documentsListSchema,
  documentSummarySchema,
} from "../shared/documents.js";
import { workspaceContextSchema } from "../shared/workspace.js";

import {
  listVerifications,
  getVerification,
} from "../server/domain/verification.js";
import {
  verificationListSchema,
  verificationSchema,
} from "../shared/verification.js";

const navigationSchema = z
  .object({
    view: z.string().optional(),
    activeWorkspaceId: z.string().optional(),
    activeHandoverPlanId: z.string().optional(),
    selectedFindingIds: z.array(z.string()).max(30).optional(),
    selectedFindingId: z.string().optional(),
    riskStatus: z.string().optional(),
    selectedMapNodeId: z.string().optional(),
    mapConfirmedOnly: z.boolean().optional(),
    mapAllPeople: z.boolean().optional(),
    selectedPersonId: z.string().optional(),
    selectedTaskId: z.string().optional(),
    selectedRunId: z.string().optional(),
    selectedDocumentId: z.string().optional(),
  })
  .passthrough();

export default defineAction({
  description:
    "Read current navigation and the saved Continuity workspace with its selected person. Use for a fresh screen snapshot; navigation is already in current-screen.",
  schema: z.object({}),
  outputSchema: z.object({
    navigation: z.unknown().optional(),
    workspaceContext: workspaceContextSchema.optional(),
    verificationList: verificationListSchema.optional(),
    selectedVerification: verificationSchema.optional(),
    taskList: tasksListSchema.optional(),
    selectedTask: taskSchema.optional(),
    documentList: documentsListSchema.optional(),
    selectedDocument: documentSummarySchema.optional(),
    documentKnowledge: knowledgeListSchema.optional(),
    knowledgeMap: knowledgeMapSchema.optional(),
    riskList: riskListSchema.optional(),
    selectedFinding: riskSchema.optional(),
    overview: overviewSchema.optional(),
    planList: planListSchema.optional(),
    handoverPlan: planSchema.optional(),
  }),
  errors: planErrors,
  http: false,
  readOnly: true,
  run: async (_input, context) => {
    const navigation = await readAppState("navigation");

    const screen: {
      navigation?: unknown;
      workspaceContext?: z.infer<typeof workspaceContextSchema>;
      verificationList?: z.infer<typeof verificationListSchema>;
      selectedVerification?: z.infer<typeof verificationSchema>;
      taskList?: z.infer<typeof tasksListSchema>;
      selectedTask?: z.infer<typeof taskSchema>;
      documentList?: z.infer<typeof documentsListSchema>;
      overview?: z.infer<typeof overviewSchema>;
      planList?: z.infer<typeof planListSchema>;
      handoverPlan?: z.infer<typeof planSchema>;
      riskList?: z.infer<typeof riskListSchema>;
      selectedFinding?: z.infer<typeof riskSchema>;
      knowledgeMap?: z.infer<typeof knowledgeMapSchema>;
      documentKnowledge?: z.infer<typeof knowledgeListSchema>;
      selectedDocument?: z.infer<typeof documentSummarySchema>;
    } = {};
    if (navigation) screen.navigation = navigation;

    const parsed = navigationSchema.safeParse(navigation);
    if (
      parsed.success &&
      [
        "overview",
        "workspace",
        "documents",
        "verification",
        "tasks",
        "knowledge-map",
        "risks",
        "handover",
      ].includes(parsed.data.view ?? "") &&
      context?.userEmail
    ) {
      screen.workspaceContext = await getWorkspaceContext(
        {
          workspaceId: parsed.data.activeWorkspaceId,
          selectedPersonId:
            parsed.data.view === "knowledge-map" &&
            parsed.data.selectedMapNodeId?.startsWith("person:")
              ? parsed.data.selectedMapNodeId.slice(7)
              : parsed.data.selectedPersonId,
        },
        context,
      );
      if (parsed.data.view === "overview")
        screen.overview = await getOverview(
          { workspaceId: parsed.data.activeWorkspaceId },
          context,
        );
      if (
        parsed.data.view === "handover" &&
        screen.workspaceContext.workspace
      ) {
        const workspaceId = screen.workspaceContext.workspace.id;
        screen.planList = await listPlans({ workspaceId }, context);
        const personId =
          parsed.data.selectedPersonId ??
          screen.workspaceContext.selectedPerson?.id;
        const id =
          parsed.data.activeHandoverPlanId ??
          screen.planList.plans.find((p) => p.personId === personId)?.id;
        if (id)
          screen.handoverPlan = await getPlan({ workspaceId, id }, context);
        screen.riskList = await listRisks({ workspaceId, personId }, context);
      }
      if (parsed.data.view === "risks" && screen.workspaceContext.workspace) {
        const workspaceId = screen.workspaceContext.workspace.id;
        const status = riskStatusSchema.safeParse(parsed.data.riskStatus);
        screen.riskList = await listRisks(
          {
            workspaceId,
            personId: parsed.data.mapAllPeople
              ? undefined
              : (parsed.data.selectedPersonId ??
                screen.workspaceContext.selectedPerson?.id),
            status: status.success ? status.data : undefined,
          },
          context,
        );
        if (parsed.data.selectedFindingId)
          screen.selectedFinding = await getRisk(
            { workspaceId, id: parsed.data.selectedFindingId },
            context,
          );
      }
      if (
        parsed.data.view === "knowledge-map" &&
        screen.workspaceContext.workspace
      ) {
        screen.knowledgeMap = await getKnowledgeMap(
          {
            workspaceId: screen.workspaceContext.workspace.id,
            personId: parsed.data.mapAllPeople
              ? undefined
              : (parsed.data.selectedPersonId ??
                screen.workspaceContext.selectedPerson?.id),
            nodeId: parsed.data.selectedMapNodeId,
            confirmedOnly: parsed.data.mapConfirmedOnly ?? false,
          },
          context,
        );
      }
      if (parsed.data.view === "tasks" && screen.workspaceContext.workspace) {
        const workspaceId = screen.workspaceContext.workspace.id;
        screen.taskList = await listTasks({ workspaceId }, context);
        if (parsed.data.selectedTaskId)
          screen.selectedTask = await getTask(
            { workspaceId, id: parsed.data.selectedTaskId },
            context,
          );
        if (parsed.data.selectedRunId)
          screen.selectedVerification = await getVerification(
            { workspaceId, id: parsed.data.selectedRunId },
            context,
          );
      }
      if (
        parsed.data.view === "verification" &&
        screen.workspaceContext.workspace
      ) {
        const workspaceId = screen.workspaceContext.workspace.id;
        screen.verificationList = await listVerifications(
          { workspaceId },
          context,
        );
        if (parsed.data.selectedRunId)
          screen.selectedVerification = await getVerification(
            { workspaceId, id: parsed.data.selectedRunId },
            context,
          );
      }
      if (
        parsed.data.view === "documents" &&
        screen.workspaceContext.workspace
      ) {
        const workspaceId = screen.workspaceContext.workspace.id;
        screen.documentList = await listDocuments({ workspaceId }, context);
        if (parsed.data.selectedDocumentId) {
          const selected = await getDocument(
            { workspaceId, id: parsed.data.selectedDocumentId },
            context,
          );
          screen.selectedDocument = documentSummarySchema.parse(selected);
          screen.documentKnowledge = await listKnowledge(
            { workspaceId, documentId: selected.id },
            context,
          );
        }
      }
    }
    return screen;
  },
});
