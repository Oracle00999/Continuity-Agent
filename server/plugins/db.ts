import { riskMachine } from "../domain/risk-lifecycle.js";
import { knowledgeMachine } from "../domain/knowledge-lifecycle.js";
import { taskMachine } from "../domain/task-lifecycle.js";
import { verificationMachine } from "../domain/verification-lifecycle.js";

import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      name: "continuity-workspace-foundation",
      sql: `
    CREATE TABLE IF NOT EXISTS continuity_workspaces (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, org_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS continuity_workspace_owner_org
      ON continuity_workspaces(owner_email, org_id);
    CREATE TABLE IF NOT EXISTS continuity_people (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES continuity_workspaces(id),
      name TEXT NOT NULL, role TEXT NOT NULL, departure_date TEXT
    );
    CREATE INDEX IF NOT EXISTS continuity_people_workspace ON continuity_people(workspace_id);
    CREATE TABLE IF NOT EXISTS continuity_systems (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES continuity_workspaces(id),
      name TEXT NOT NULL, description TEXT NOT NULL,
      criticality TEXT NOT NULL CHECK (criticality IN ('critical', 'high', 'normal'))
    );
    CREATE INDEX IF NOT EXISTS continuity_systems_workspace ON continuity_systems(workspace_id);
    CREATE TABLE IF NOT EXISTS continuity_activity_events (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES continuity_workspaces(id),
      actor TEXT NOT NULL, event_type TEXT NOT NULL, summary TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS continuity_activity_workspace
      ON continuity_activity_events(workspace_id, created_at);
  `,
    },
    {
      version: 2,
      name: "continuity-child-tenant-scope-and-demo-key",
      sql: `
    ALTER TABLE continuity_workspaces ADD COLUMN IF NOT EXISTS demo_key TEXT DEFAULT 'northstar';
    CREATE UNIQUE INDEX IF NOT EXISTS continuity_workspace_demo ON continuity_workspaces(owner_email, org_id, demo_key);
    DROP INDEX IF EXISTS continuity_workspace_owner_org;
    ALTER TABLE continuity_people ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT '';
    ALTER TABLE continuity_people ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE continuity_systems ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT '';
    ALTER TABLE continuity_systems ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE continuity_activity_events ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT '';
    ALTER TABLE continuity_activity_events ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT '';
    UPDATE continuity_people AS child SET owner_email = parent.owner_email, org_id = parent.org_id
      FROM continuity_workspaces AS parent WHERE child.workspace_id = parent.id;
    UPDATE continuity_systems AS child SET owner_email = parent.owner_email, org_id = parent.org_id
      FROM continuity_workspaces AS parent WHERE child.workspace_id = parent.id;
    UPDATE continuity_activity_events AS child SET owner_email = parent.owner_email, org_id = parent.org_id
      FROM continuity_workspaces AS parent WHERE child.workspace_id = parent.id;
  `,
    },
    {
      version: 3,
      name: "continuity-documents-and-source-passages",
      sql: `
        CREATE TABLE IF NOT EXISTS continuity_documents (
          id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, org_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL REFERENCES continuity_workspaces(id),
          filename TEXT NOT NULL, mime_type TEXT NOT NULL, storage_key TEXT,
          content_hash TEXT NOT NULL, source TEXT NOT NULL CHECK (source IN ('demo', 'upload')),
          status TEXT NOT NULL CHECK (status IN ('ready', 'needs_text')),
          extracted_text TEXT NOT NULL, byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
          uploaded_at TEXT NOT NULL, passage_count INTEGER NOT NULL CHECK (passage_count >= 0),
          warnings JSONB NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS continuity_document_content ON continuity_documents(workspace_id, content_hash);
        CREATE INDEX IF NOT EXISTS continuity_document_list ON continuity_documents(workspace_id, uploaded_at, id);
        CREATE TABLE IF NOT EXISTS continuity_evidence (
          id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, org_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL REFERENCES continuity_workspaces(id),
          document_id TEXT NOT NULL REFERENCES continuity_documents(id),
          quote TEXT NOT NULL, section TEXT, page_number INTEGER CHECK (page_number > 0),
          start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
          end_offset INTEGER NOT NULL CHECK (end_offset > start_offset), mentions JSONB NOT NULL
        );
        CREATE INDEX IF NOT EXISTS continuity_evidence_document ON continuity_evidence(document_id, start_offset);
      `,
    },
    {
      version: 4,
      name: "continuity-human-verification",
      sql: `CREATE TABLE IF NOT EXISTS continuity_verification_runs (
        id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, org_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES continuity_workspaces(id),
        document_id TEXT NOT NULL REFERENCES continuity_documents(id),
        source_name TEXT NOT NULL, source_hash TEXT NOT NULL,
        tester_id TEXT NOT NULL REFERENCES continuity_people(id), tester_name TEXT NOT NULL,
        request_id TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN (${verificationMachine.states.map((s) => "'" + s + "'").join(",")})),
        steps JSONB NOT NULL, summary TEXT NOT NULL, revision INTEGER NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, recorded_by TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS continuity_verification_request ON continuity_verification_runs(workspace_id, request_id);
      CREATE INDEX IF NOT EXISTS continuity_verification_list ON continuity_verification_runs(workspace_id, created_at);`,
    },
    {
      version: 5,
      name: "continuity-handover-tasks",
      sql: `
      CREATE TABLE IF NOT EXISTS continuity_handover_tasks (
        id TEXT PRIMARY KEY,owner_email TEXT NOT NULL,org_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES continuity_workspaces(id),
        run_id TEXT NOT NULL REFERENCES continuity_verification_runs(id), step_number INTEGER NOT NULL CHECK (step_number > 0),
        document_id TEXT NOT NULL REFERENCES continuity_documents(id),source_name TEXT NOT NULL,
        instruction TEXT NOT NULL,gap_notes TEXT NOT NULL,gap_result TEXT NOT NULL CHECK(gap_result IN ('blocked','unclear')),
        title TEXT NOT NULL,assignee_id TEXT NOT NULL REFERENCES continuity_people(id),assignee_name TEXT NOT NULL,
        due_date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN (${taskMachine.states.map((s) => "'" + s + "'").join(",")})),
        resolution TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,recorded_by TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS continuity_task_step ON continuity_handover_tasks(workspace_id,run_id,step_number);
      CREATE INDEX IF NOT EXISTS continuity_task_list ON continuity_handover_tasks(workspace_id,due_date,id);
      CREATE INDEX IF NOT EXISTS continuity_task_run ON continuity_handover_tasks(workspace_id,run_id);
    `,
    },
    {
      version: 6,
      name: "continuity-evidence-backed-knowledge",
      sql: `
 CREATE TABLE IF NOT EXISTS continuity_processes (
 id TEXT PRIMARY KEY,owner_email TEXT NOT NULL,org_id TEXT NOT NULL,workspace_id TEXT NOT NULL REFERENCES continuity_workspaces(id),name TEXT NOT NULL,name_key TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS continuity_process_name ON continuity_processes(workspace_id,name_key);
 CREATE TABLE IF NOT EXISTS continuity_relationships (
 id TEXT PRIMARY KEY,owner_email TEXT NOT NULL,org_id TEXT NOT NULL,workspace_id TEXT NOT NULL REFERENCES continuity_workspaces(id),
 document_id TEXT NOT NULL REFERENCES continuity_documents(id),source_name TEXT NOT NULL,person_id TEXT NOT NULL REFERENCES continuity_people(id),person_name TEXT NOT NULL,
 relationship TEXT NOT NULL CHECK(relationship IN ('owns','maintains','operates','supports')),target_kind TEXT NOT NULL CHECK(target_kind IN ('system','process')),target_key TEXT NOT NULL,target_name TEXT NOT NULL,
 system_id TEXT REFERENCES continuity_systems(id),process_id TEXT REFERENCES continuity_processes(id),
 evidence_id TEXT NOT NULL REFERENCES continuity_evidence(id),quote TEXT NOT NULL,confidence JSONB NOT NULL,
 status TEXT NOT NULL CHECK(status IN (${knowledgeMachine.states.map((s) => "'" + s + "'").join(",")})),review_notes TEXT NOT NULL,revision INTEGER NOT NULL,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,reviewed_by TEXT,
 CHECK ((target_kind='system' AND system_id IS NOT NULL AND process_id IS NULL) OR (target_kind='process' AND process_id IS NOT NULL AND system_id IS NULL)));
 CREATE UNIQUE INDEX IF NOT EXISTS continuity_relationship_claim ON continuity_relationships(document_id,person_id,relationship,target_key);
 CREATE INDEX IF NOT EXISTS continuity_relationship_document ON continuity_relationships(workspace_id,document_id,created_at);
 CREATE INDEX IF NOT EXISTS continuity_relationship_person ON continuity_relationships(workspace_id,person_id,created_at);
 `,
    },
    {
      version: 7,
      name: "continuity-risk-register",
      sql: `
 CREATE TABLE IF NOT EXISTS continuity_findings (
 id TEXT PRIMARY KEY,owner_email TEXT NOT NULL,org_id TEXT NOT NULL,workspace_id TEXT NOT NULL REFERENCES continuity_workspaces(id),
 key TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('single_owner_dependency','documentation_gap','conflicting_information','unverified_procedure','unclear_ownership')),
 title TEXT NOT NULL,description TEXT NOT NULL,severity TEXT NOT NULL CHECK(severity IN ('critical','high','medium','low')),severity_reason TEXT NOT NULL,confidence JSONB NOT NULL,uncertainty TEXT NOT NULL,recommended_action TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN (${riskMachine.states.map((s) => "'" + s + "'").join(",")})),
 person_id TEXT REFERENCES continuity_people(id),person_name TEXT,system_id TEXT REFERENCES continuity_systems(id),system_name TEXT,process_id TEXT REFERENCES continuity_processes(id),process_name TEXT,run_id TEXT REFERENCES continuity_verification_runs(id),verification_snapshot JSONB,
 review_notes TEXT NOT NULL,reviewed_by TEXT,revision INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS continuity_finding_key ON continuity_findings(workspace_id,key);
 CREATE INDEX IF NOT EXISTS continuity_finding_list ON continuity_findings(workspace_id,created_at,id);
 CREATE INDEX IF NOT EXISTS continuity_finding_person ON continuity_findings(workspace_id,person_id);
 CREATE TABLE IF NOT EXISTS continuity_finding_evidence (
 id TEXT PRIMARY KEY,owner_email TEXT NOT NULL,org_id TEXT NOT NULL,workspace_id TEXT NOT NULL REFERENCES continuity_workspaces(id),finding_id TEXT NOT NULL REFERENCES continuity_findings(id),evidence_id TEXT NOT NULL REFERENCES continuity_evidence(id),document_id TEXT NOT NULL REFERENCES continuity_documents(id),source_name TEXT NOT NULL,quote TEXT NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS continuity_finding_passage ON continuity_finding_evidence(finding_id,evidence_id);
 CREATE INDEX IF NOT EXISTS continuity_finding_evidence_list ON continuity_finding_evidence(workspace_id,finding_id);
 `,
    },
    {
      version: 8,
      name: "continuity-departure-plans",
      sql: `
 CREATE TABLE IF NOT EXISTS continuity_handover_plans (
 id TEXT PRIMARY KEY,owner_email TEXT NOT NULL,org_id TEXT NOT NULL,workspace_id TEXT NOT NULL REFERENCES continuity_workspaces(id),person_id TEXT NOT NULL REFERENCES continuity_people(id),person_name TEXT NOT NULL,departure_date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('draft','approved')),revision INTEGER NOT NULL,review_notes TEXT NOT NULL,approved_by TEXT,approved_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS continuity_plan_person ON continuity_handover_plans(workspace_id,person_id);
 CREATE INDEX IF NOT EXISTS continuity_plan_list ON continuity_handover_plans(workspace_id,updated_at);
 ALTER TABLE continuity_handover_tasks ADD COLUMN IF NOT EXISTS plan_id TEXT REFERENCES continuity_handover_plans(id);
 ALTER TABLE continuity_handover_tasks ADD COLUMN IF NOT EXISTS finding_id TEXT REFERENCES continuity_findings(id);
 ALTER TABLE continuity_handover_tasks ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
 ALTER TABLE continuity_handover_tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('critical','high','medium','low'));
 ALTER TABLE continuity_handover_tasks ADD COLUMN IF NOT EXISTS assignment_status TEXT NOT NULL DEFAULT 'confirmed' CHECK(assignment_status IN ('suggested','confirmed'));
 ALTER TABLE continuity_handover_tasks ALTER COLUMN run_id DROP NOT NULL;
 ALTER TABLE continuity_handover_tasks ALTER COLUMN step_number DROP NOT NULL;
 ALTER TABLE continuity_handover_tasks ALTER COLUMN gap_result DROP NOT NULL;
 ALTER TABLE continuity_handover_tasks ALTER COLUMN assignee_id DROP NOT NULL;
 ALTER TABLE continuity_handover_tasks ALTER COLUMN assignee_name DROP NOT NULL;
 ALTER TABLE continuity_handover_tasks ALTER COLUMN due_date DROP NOT NULL;
 ALTER TABLE continuity_handover_tasks ADD CONSTRAINT continuity_task_origin CHECK((run_id IS NOT NULL AND step_number IS NOT NULL) OR (plan_id IS NOT NULL AND finding_id IS NOT NULL));
 ALTER TABLE continuity_handover_tasks ADD CONSTRAINT continuity_task_assignment CHECK(assignment_status='suggested' OR (assignee_id IS NOT NULL AND due_date IS NOT NULL));
 CREATE UNIQUE INDEX IF NOT EXISTS continuity_task_plan_finding ON continuity_handover_tasks(plan_id,finding_id);
 CREATE INDEX IF NOT EXISTS continuity_task_plan ON continuity_handover_tasks(workspace_id,plan_id);
 `,
    },
  ],
  { table: "continuity_migrations" },
);
