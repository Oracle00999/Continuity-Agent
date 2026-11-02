import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { DocumentMention } from "../../shared/documents.js";

export const workspaces = pgTable(
  "continuity_workspaces",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id").notNull().default(""),
    name: text("name").notNull(),
    demoKey: text("demo_key").default("northstar"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("continuity_workspace_demo").on(
      table.ownerEmail,
      table.orgId,
      table.demoKey,
    ),
  ],
);

export const people = pgTable(
  "continuity_people",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull().default(""),
    orgId: text("org_id").notNull().default(""),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    role: text("role").notNull(),
    departureDate: text("departure_date"),
  },
  (table) => [index("continuity_people_workspace").on(table.workspaceId)],
);

export const systems = pgTable(
  "continuity_systems",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull().default(""),
    orgId: text("org_id").notNull().default(""),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    description: text("description").notNull(),
    criticality: text("criticality", {
      enum: ["critical", "high", "normal"],
    }).notNull(),
  },
  (table) => [index("continuity_systems_workspace").on(table.workspaceId)],
);

export const activityEvents = pgTable(
  "continuity_activity_events",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull().default(""),
    orgId: text("org_id").notNull().default(""),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    actor: text("actor").notNull(),
    eventType: text("event_type").notNull(),
    summary: text("summary").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("continuity_activity_workspace").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const documents = pgTable(
  "continuity_documents",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    storageKey: text("storage_key"),
    contentHash: text("content_hash").notNull(),
    source: text("source", { enum: ["demo", "upload"] }).notNull(),
    status: text("status", { enum: ["ready", "needs_text"] }).notNull(),
    extractedText: text("extracted_text").notNull(),
    byteSize: integer("byte_size").notNull(),
    uploadedAt: text("uploaded_at").notNull(),
    passageCount: integer("passage_count").notNull(),
    warnings: jsonb("warnings").$type<string[]>().notNull(),
  },
  (table) => [
    uniqueIndex("continuity_document_content").on(
      table.workspaceId,
      table.contentHash,
    ),
    index("continuity_document_list").on(
      table.workspaceId,
      table.uploadedAt,
      table.id,
    ),
  ],
);

export const evidence = pgTable(
  "continuity_evidence",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    quote: text("quote").notNull(),
    section: text("section"),
    pageNumber: integer("page_number"),
    startOffset: integer("start_offset").notNull(),
    endOffset: integer("end_offset").notNull(),
    mentions: jsonb("mentions").$type<DocumentMention[]>().notNull(),
  },
  (table) => [
    index("continuity_evidence_document").on(
      table.documentId,
      table.startOffset,
    ),
  ],
);

export const verificationRuns = pgTable(
  "continuity_verification_runs",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    sourceName: text("source_name").notNull(),
    sourceHash: text("source_hash").notNull(),
    testerId: text("tester_id")
      .notNull()
      .references(() => people.id),
    testerName: text("tester_name").notNull(),
    requestId: text("request_id").notNull(),
    status: text("status").notNull(),
    steps: jsonb("steps")
      .$type<import("../../shared/verification.js").VerificationStep[]>()
      .notNull(),
    summary: text("summary").notNull(),
    revision: integer("revision").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    recordedBy: text("recorded_by").notNull(),
  },
  (table) => [
    uniqueIndex("continuity_verification_request").on(
      table.workspaceId,
      table.requestId,
    ),
    index("continuity_verification_list").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const handoverTasks = pgTable(
  "continuity_handover_tasks",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    runId: text("run_id").references(() => verificationRuns.id),
    stepNumber: integer("step_number"),
    planId: text("plan_id").references(() => handoverPlans.id),
    findingId: text("finding_id").references(() => findings.id),
    description: text("description").notNull().default(""),
    priority: text("priority").notNull().default("medium"),
    assignmentStatus: text("assignment_status").notNull().default("confirmed"),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    sourceName: text("source_name").notNull(),
    instruction: text("instruction").notNull(),
    gapNotes: text("gap_notes").notNull(),
    gapResult: text("gap_result"),
    title: text("title").notNull(),
    assigneeId: text("assignee_id").references(() => people.id),
    assigneeName: text("assignee_name"),
    dueDate: text("due_date"),
    status: text("status").notNull(),
    resolution: text("resolution").notNull(),
    revision: integer("revision").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    recordedBy: text("recorded_by").notNull(),
  },
  (table) => [
    uniqueIndex("continuity_task_step").on(
      table.workspaceId,
      table.runId,
      table.stepNumber,
    ),
    index("continuity_task_list").on(
      table.workspaceId,
      table.dueDate,
      table.id,
    ),
    uniqueIndex("continuity_task_plan_finding").on(
      table.planId,
      table.findingId,
    ),
    index("continuity_task_plan").on(table.workspaceId, table.planId),
    index("continuity_task_run").on(table.workspaceId, table.runId),
  ],
);

export const processes = pgTable(
  "continuity_processes",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("continuity_process_name").on(t.workspaceId, t.nameKey)],
);
export const relationships = pgTable(
  "continuity_relationships",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    sourceName: text("source_name").notNull(),
    personId: text("person_id")
      .notNull()
      .references(() => people.id),
    personName: text("person_name").notNull(),
    relationship: text("relationship").notNull(),
    targetKind: text("target_kind").notNull(),
    targetKey: text("target_key").notNull(),
    targetName: text("target_name").notNull(),
    systemId: text("system_id").references(() => systems.id),
    processId: text("process_id").references(() => processes.id),
    evidenceId: text("evidence_id")
      .notNull()
      .references(() => evidence.id),
    quote: text("quote").notNull(),
    confidence: jsonb("confidence").$type<number>().notNull(),
    status: text("status").notNull(),
    reviewNotes: text("review_notes").notNull(),
    revision: integer("revision").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    reviewedBy: text("reviewed_by"),
  },
  (t) => [
    uniqueIndex("continuity_relationship_claim").on(
      t.documentId,
      t.personId,
      t.relationship,
      t.targetKey,
    ),
    index("continuity_relationship_document").on(
      t.workspaceId,
      t.documentId,
      t.createdAt,
    ),
    index("continuity_relationship_person").on(
      t.workspaceId,
      t.personId,
      t.createdAt,
    ),
  ],
);

export const findings = pgTable(
  "continuity_findings",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    key: text("key").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    severity: text("severity").notNull(),
    severityReason: text("severity_reason").notNull(),
    confidence: jsonb("confidence").$type<number>().notNull(),
    uncertainty: text("uncertainty").notNull(),
    recommendedAction: text("recommended_action").notNull(),
    status: text("status").notNull(),
    personId: text("person_id").references(() => people.id),
    personName: text("person_name"),
    systemId: text("system_id").references(() => systems.id),
    systemName: text("system_name"),
    processId: text("process_id").references(() => processes.id),
    processName: text("process_name"),
    runId: text("run_id").references(() => verificationRuns.id),
    verificationSnapshot: jsonb("verification_snapshot").$type<
      import("zod").infer<
        typeof import("../../shared/risks.js").riskSchema
      >["verificationSnapshot"]
    >(),
    reviewNotes: text("review_notes").notNull(),
    reviewedBy: text("reviewed_by"),
    revision: integer("revision").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("continuity_finding_key").on(t.workspaceId, t.key),
    index("continuity_finding_list").on(t.workspaceId, t.createdAt, t.id),
    index("continuity_finding_person").on(t.workspaceId, t.personId),
  ],
);
export const findingEvidence = pgTable(
  "continuity_finding_evidence",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    findingId: text("finding_id")
      .notNull()
      .references(() => findings.id),
    evidenceId: text("evidence_id")
      .notNull()
      .references(() => evidence.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    sourceName: text("source_name").notNull(),
    quote: text("quote").notNull(),
  },
  (t) => [
    uniqueIndex("continuity_finding_passage").on(t.findingId, t.evidenceId),
    index("continuity_finding_evidence_list").on(t.workspaceId, t.findingId),
  ],
);

export const handoverPlans = pgTable(
  "continuity_handover_plans",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    orgId: text("org_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    personId: text("person_id")
      .notNull()
      .references(() => people.id),
    personName: text("person_name").notNull(),
    departureDate: text("departure_date").notNull(),
    status: text("status").notNull(),
    revision: integer("revision").notNull(),
    reviewNotes: text("review_notes").notNull(),
    approvedBy: text("approved_by"),
    approvedAt: text("approved_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("continuity_plan_person").on(t.workspaceId, t.personId),
    index("continuity_plan_list").on(t.workspaceId, t.updatedAt),
  ],
);
