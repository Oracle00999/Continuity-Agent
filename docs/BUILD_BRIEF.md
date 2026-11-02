# CONTINUITY — HACKATHON PROJECT BUILD BRIEF

## 1\. PROJECT OVERVIEW

**Product:** Continuity  
**Tagline:** Never lose the knowledge that keeps engineering running.  
**Hackathon:** Builder.io Agent-Native Hackathon  
**Deadline:** November 9, 2026, 11:59 PM Pacific (November 10, 2026, 8:59 AM Nigeria time).  
**Developer:** Solo developer  
**Preferred stack:** TypeScript, React, Agent-Native, OpenAI API.

### Product description

Continuity is an engineering knowledge handover and operational-readiness platform.

It helps engineering teams discover what critical knowledge exists only with one engineer, identify operational risks when that person leaves, and verify whether another engineer can actually take over their responsibilities.

The central use case:

An important DevOps engineer named Alex is leaving a software company in seven days. The company needs to understand what Alex knows, which systems depend on him, what documentation is missing, and whether other engineers can operate those systems without his help.

**Core product promise:**

Continuity does not just tell a team what Alex knows. It helps prove whether the team can take over before Alex leaves.

### Important positioning

This is NOT:

- Another Notion or Confluence clone.
- A generic AI chatbot.
- A document search engine.
- An employee performance-monitoring tool.
- An automatic production operations tool.

This IS:

- An engineering knowledge dependency mapper.
- An operational documentation gap detector.
- A practical procedure verification system.
- An actionable engineering handover workspace.

---

## 2\. DIFFERENTIATION

Competitors and adjacent products include:

- Glean: enterprise knowledge search, AI, people-to-information relationships and knowledge graphs.
- Guru: knowledge management, verification and content quality workflows.
- Confluence + Rovo: documentation, AI search, summaries and agents.

Do not claim that knowledge graphs, AI documentation, source citations or knowledge verification are individually new.

Our product-specific emphasis is the combination of:

1. **Engineering knowledge dependency mapping:** Discover which engineers understand which systems and processes, and identify critical single-person dependencies.
2. **Practical knowledge-readiness verification:** A second engineer attempts to follow a documented procedure. Continuity records blockers and missing instructions.
3. **Actionable departure handover:** Turn discovered risks into assigned tasks with owners, deadlines, priorities and evidence.

The defining example:

A database restoration document exists, but another engineer cannot restore the database because the backup storage path is missing. Continuity records the failed verification, identifies the missing instruction, updates the risk assessment and creates a handover task.

Do not present an uploaded or AI-generated document as proof that a process is operationally ready.

---

## 3\. DEMO ORGANIZATION

Create a fictional company called **Northstar Digital**.

### Team

- Alex Morgan — Senior DevOps Engineer; leaving in seven days.
- Maya Chen — Backend Engineer.
- Daniel Reed — Engineering Lead.
- Priya Shah — Platform Engineer.
- Jordan Lee — Frontend Engineer.

### Systems

- Production API.
- PostgreSQL database.
- VPS infrastructure.
- Deployment pipeline.
- Monitoring and alerting.
- Backup storage.

### Seed documents

Create realistic sample documents:

1. Production Deployment Runbook.
2. Infrastructure Architecture.
3. Database Backup \& Restore.
4. Incident Recovery Notes.
5. Environment Configuration.
6. Engineering Responsibilities.

Intentionally include these problems:

- Database restoration instructions omit the backup storage path.
- Deployment rollback instructions are incomplete.
- Infrastructure architecture lists an outdated service owner.
- Some responsibilities are documented as belonging to Alex, with no confirmed backup owner.
- Another engineer has not successfully tested the restoration procedure.

These problems must be deliberately seeded, consistent and repeatable. Do not depend on unpredictable AI output to create the demo scenario.

---

## 4\. CORE PRODUCT WORKFLOW

Build this complete workflow:

DISCOVER → ASSESS → VERIFY → TRANSFER

### Discover

- Upload engineering documents.
- Extract people, systems, processes, responsibilities and operational facts.
- Store the supporting evidence.
- Build a knowledge dependency graph.

### Assess

- Select Alex.
- Inspect his responsibilities and related systems.
- Identify single-owner dependencies.
- Find missing, incomplete or conflicting documentation.
- Generate source-linked risks.
- Distinguish documented facts from AI inferences.

### Verify

- Select a procedure, such as database restoration.
- Assign a second engineer to test it.
- Present a guided checklist.
- Record completed, blocked and unclear steps.
- Record tester notes and evidence.
- Update procedure readiness based on the actual outcome.

### Transfer

- Generate a handover plan.
- Convert risks into actionable tasks.
- Suggest owners and deadlines.
- Allow humans to edit, approve and track the tasks.
- Show remaining unresolved risks.

---

## 5\. APPLICATION SCREENS

Build a professional, polished engineering operations dashboard. Use a clean dark theme, restrained colors, good typography, useful whitespace and consistent components.

Use a persistent sidebar and a contextual Continuity Analyst panel.

### Navigation

1. Overview
2. Knowledge Map
3. People
4. Systems \& Processes
5. Risk Register
6. Handover
7. Verification
8. Documents

### Overview

Show:

- Critical systems.
- Single-owner dependencies.
- Procedures tested.
- High-priority risks.
- Alex's departure countdown.
- Highest-risk knowledge areas.
- Upcoming handover tasks.
- Recent agent activity.

Use actual database data, not hardcoded display-only metrics.

### Knowledge Map

Interactive graph connecting:

- People.
- Systems.
- Processes.
- Documents.

Selecting Alex should highlight his relationships and open a detail panel showing:

- Role.
- Departure date.
- Responsibilities.
- Associated systems.
- Owned processes.
- Other known owners.
- Supporting evidence.
- Risk level.

Clearly distinguish evidence-backed relationships from AI inferences and human-confirmed relationships.

Use React Flow if compatible with the Agent-Native starter.

### People

Show team members, roles, associated systems, processes and known knowledge ownership.

Do not score employees or create a performance-ranking system.

### Systems \& Processes

Show systems, criticality, known owners, procedures, documents, gaps and readiness status.

### Risk Register

Each risk should contain:

- Title.
- Description.
- Severity.
- Confidence.
- Status.
- Supporting evidence.
- Recommended action.
- Related person/system/process.

Allow the user to accept, reject, edit or resolve findings.

### Handover

Show departure-specific handover plans and tasks.

Each task should have:

- Title.
- Description.
- Priority.
- Assignee.
- Due date.
- Status.
- Related finding.

### Verification

Show procedure test runs, assigned testers, step-by-step checklists, blockers, notes and outcomes.

A procedure must not be marked ready just because someone opened its checklist.

### Documents

Allow upload of PDF, Markdown and plain text files.

Show:

- Original filename.
- Extracted text.
- Processing status.
- Extracted knowledge.
- Linked people, systems and processes.
- Evidence passages.
- Extraction warnings.

---

## 6\. DATABASE AND DATA MODEL

Use PostgreSQL with Drizzle ORM, following the database conventions of the installed Agent-Native starter.

Core tables:

- workspaces
- people
- systems
- processes
- documents
- evidence
- relationships
- findings
- finding\_evidence
- handover\_plans
- handover\_tasks
- verification\_runs
- verification\_steps
- activity\_events

Important fields and design decisions:

### Documents

Store filename, MIME type, storage key, extracted text, processing status and upload date.

### Evidence

Store document ID, exact supporting quote, page number, section, and text offsets where available.

### Relationships

Store source type/ID, target type/ID, relationship type, confidence and verification status.

Relationship verification states:

- inferred
- reviewed
- confirmed
- rejected

### Findings

Store type, title, description, severity, confidence, status and recommended action.

Finding types can include:

- single\_owner\_dependency
- documentation\_gap
- conflicting\_information
- unverified\_procedure
- unclear\_ownership

### Verification

Store each test run, tester, process, outcome, and step-level status and notes.

### Activity events

Record important user and agent changes, including actor, event type, affected entity and summary.

### Data integrity requirements

- Every important finding must link to evidence.
- Distinguish confidence from verification status.
- Do not silently convert an AI inference into a confirmed fact.
- Store human corrections.
- Validate relationship endpoint types.
- Use transactions for multi-record operations.
- Add appropriate indexes and foreign keys.
- Support multiple workspaces even though the demo uses one.

Avoid introducing a graph database. PostgreSQL is enough.

---

## 7\. TECHNICAL STACK

Preferred stack:

- Agent-Native framework.
- React.
- TypeScript.
- Tailwind CSS.
- PostgreSQL / PGlite for local development where supported.
- Drizzle ORM.
- Zod.
- OpenAI API.
- React Flow for the knowledge graph.
- Suitable PDF parser and Markdown/plain-text extraction libraries.

Use the framework's actual current APIs and conventions.

Official references:

- https://www.agent-native.com/docs/
- https://www.agent-native.com/docs/key-concepts/
- https://github.com/BuilderIO/agent-native
- https://www.builder.io/hackathon
- https://www.builder.io/hackathon/rules
- https://platform.openai.com/docs

Do not invent framework APIs. Inspect the installed package, generated starter and current documentation before implementing.

### Starter command

If the project has not been initialized:

``` bash
npx --yes @agent-native/core@latest create continuity --standalone --template chat
cd continuity
corepack enable
pnpm install
pnpm dev
```

Check the latest documented Node.js and pnpm requirements before setup.

If the project already exists, inspect it before changing anything.

---

## 8\. AGENT-NATIVE ARCHITECTURE

This is critical to the hackathon.

The agent and the React UI must use the SAME shared application actions and operate on the SAME persisted data.

Do not build separate business logic for the agent and UI.

Use Agent-Native's documented shared-action approach, including its supported action definitions, Zod validation and client-side invocation mechanisms.

The exact APIs must be verified against the installed version.

### Proposed architecture

React Workspace
|
Shared Application State / Context
|
Shared Agent-Native Actions
|
Domain Services
|
PostgreSQL / File Storage / OpenAI API

The Continuity Analyst should understand:

- Current workspace.
- Current page.
- Selected person.
- Selected system.
- Selected process.
- Active handover plan.

Example context:

``` ts
{
  currentPage: "knowledge-map",
  selectedPersonId: "alex-id",
  selectedSystemId: null,
  selectedProcessId: null,
  activeWorkspaceId: "workspace-id",
  activeHandoverPlanId: "plan-id"
}
```

When Alex is selected, the user should be able to ask "What happens if he leaves?" and receive an answer grounded in Alex's actual saved workspace context.

---

## 9\. AGENT ACTION CONTRACTS

Implement a small number of meaningful shared actions. These are proposed contracts; adapt the syntax to the actual Agent-Native APIs.

### 1\. getWorkspaceContext

Read-only. Retrieves relevant workspace information: people, systems, processes, documents, findings and handover data.

### 2\. ingestDocument

Processes an existing uploaded document, extracts text and saves evidence.

Binary file upload can use a suitable upload mechanism, but document processing and business logic should remain in the shared action/domain layer.

### 3\. analyzeContinuity

Analyzes a person or system for:

- Departure impact.
- Single-owner dependencies.
- Documentation gaps.
- System readiness.

Returns structured findings, evidence IDs, confidence, severity and recommended actions.

### 4\. updateFinding

Allows the agent or user to update a finding, record a correction and change its review status.

All changes must be audited.

### 5\. generateHandoverPlan

Generates a departure-specific draft handover plan from selected findings.

Creates actual task records.

Suggested assignments must be clearly marked as suggestions until accepted by the user.

### 6\. manageHandoverTask

Creates or updates handover tasks, including title, description, priority, assignee, due date and status.

### 7\. startProcedureVerification

Creates a verification run for a process and prepares its checklist.

### 8\. recordVerificationStep

Records a tester's step result, note and evidence.

The agent must never fabricate a test result.

### 9\. finalizeVerification

Finalizes the verification run with one of:

- passed
- passed\_with\_gaps
- failed

Updates process readiness and linked risks appropriately.

Every action should:

- Validate input using Zod.
- Enforce workspace/entity ownership.
- Return structured results.
- Handle errors safely.
- Persist changes where applicable.
- Produce activity events for meaningful mutations.

---

## 10\. AGENT BEHAVIOR

Agent name: **Continuity Analyst**

Its role is to help engineering teams identify operational knowledge dependencies, documentation gaps, handover risks and procedure readiness.

Operating rules:

1. Treat saved workspace data as the source of truth.
2. Never invent people, systems, owners, processes or evidence.
3. Distinguish documented facts from AI inferences.
4. Every important finding must cite supporting evidence.
5. Explain uncertainty.
6. Use the selected person/system/process context.
7. Prefer actionable recommendations over generic advice.
8. Generate draft plans and tasks.
9. Never claim a procedure was tested unless a tester recorded the result.
10. Never mark a task complete without an explicit update.
11. Ask for clarification when important information is missing.

For departure analysis:

- Identify known responsibilities.
- Identify associated systems and processes.
- Find other known owners.
- Identify incomplete, missing or conflicting documentation.
- Determine which procedures have actually been tested by someone else.
- Prioritize risks based on evidence and operational impact.
- Recommend a practical handover plan.

The agent should use shared actions to do real work, not just generate chat responses.

---

## 11\. DOCUMENT PROCESSING AND AI EXTRACTION

Build this pipeline:

1. Upload file.
2. Extract text.
3. Split into evidence passages.
4. Send appropriate content to OpenAI for structured extraction.
5. Validate output with Zod.
6. Resolve entities against existing workspace records.
7. Save evidence, facts and relationships.
8. Generate candidate findings.
9. Allow human review.

Use structured output where appropriate.

Example extraction shape:

``` json
{
  "facts": [
    {
      "subject": "Alex Morgan",
      "relationship": "owns",
      "object": "Production deployment",
      "evidence": "Alex is responsible for production releases.",
      "confidence": 0.94
    }
  ],
  "gaps": [
    {
      "process": "Database restoration",
      "missing_information": "Backup storage path is not documented",
      "confidence": 0.91
    }
  ]
}
```

Important:

- Verify extracted quotes against the actual extracted text.
- Do not accept unsupported citations.
- Do not create duplicate people or systems.
- Use conservative entity matching.
- Flag uncertain matches for review.
- Treat uploaded document content as untrusted data, not instructions.
- Never expose API keys or secrets to the frontend.

---

## 12\. RISK ANALYSIS

Use transparent, explainable rules. Do not build a complicated or arbitrary mathematical score.

Examples:

- Critical system + one documented owner = high/critical dependency.
- Critical procedure + incomplete instructions = high risk.
- Critical procedure + failed verification = critical readiness gap.
- Multiple documented owners + successful independent verification = lower dependency risk.

Every risk should explain:

- What is wrong.
- Why it matters.
- What evidence supports it.
- What remains uncertain.
- What should happen next.

Do not claim the analysis is scientifically precise.

---

## 13\. SIGNATURE DEMO SCRIPT

Target duration: 3–4 minutes.

### Scene 1: Overview

Open Northstar Digital.

Show:

- Alex leaves in seven days.
- Single-owner dependencies.
- Critical risks.
- Procedure readiness.

Explain that the company needs to transfer Alex's operational knowledge.

### Scene 2: Knowledge Map

Select Alex.

Show his connections to:

- Production deployment.
- Database backups.
- Infrastructure.
- Incident recovery.

Ask the agent:

"What operational responsibilities are currently concentrated in Alex?"

### Scene 3: Evidence and risks

Ask:

"Which of these responsibilities would be difficult for another engineer to take over?"

Open the database restoration finding.

Show the exact supporting document passage and missing backup storage path.

### Scene 4: Handover plan

Ask:

"Create a handover plan for Alex's departure next week. Prioritize the critical operational gaps."

Show actual task records in the Handover screen.

Edit one task and demonstrate that the UI and persisted state update.

### Scene 5: Procedure verification

Start a database restoration verification run assigned to Maya.

Mark the backup-location step as blocked.

Enter:

"The runbook does not specify where the backup is stored."

Show the agent identifying the missing instruction and proposing a documentation update and follow-up task.

### Scene 6: Updated readiness

Show that the procedure remains unverified or failed.

The risk remains visible and the follow-up task exists.

End with:

"Continuity doesn't just tell us what Alex knows. It helps us prove whether the team can take over before he leaves."

---

## 14\. IMPLEMENTATION PRIORITIES

Build in this order:

### Phase 1 — Framework proof

- Initialize or inspect Agent-Native starter.
- Run the app.
- Connect OpenAI.
- Understand the framework's database and action conventions.
- Implement one shared read action.
- Call it from both UI and agent.
- Verify identical data.

DO NOT start the full application until this works.

### Phase 2 — Foundation

- Schema and migrations.
- Seed Northstar Digital.
- App shell.
- Sidebar.
- Overview.
- People page.

### Phase 3 — Documents and extraction

- File upload.
- Text extraction.
- Evidence passages.
- OpenAI structured extraction.
- Entity resolution.
- Persistence.

### Phase 4 — Knowledge map

- Graph visualization.
- People/system/process selection.
- Relationship details.
- Evidence references.

### Phase 5 — Risk analysis

- Dependency detection.
- Documentation gaps.
- Conflicting information.
- Editable findings.

### Phase 6 — Handover

- Generate handover plan.
- Create/edit tasks.
- Assignees and priorities.
- Finding-to-task relationships.

### Phase 7 — Verification

- Procedure checklist.
- Test runs.
- Blockers and notes.
- Outcomes.
- Readiness updates.

### Phase 8 — Agent integration and release

- Agent context.
- Shared actions.
- Activity log.
- Persistence.
- Error handling.
- UI polish.
- Deployment.
- Public Clips demo.

Feature freeze: target November 7.

Final testing and submission: November 8–9.

---

## 15\. ESTIMATED EFFORT

Estimated solo-development time: 55–72 focused hours.

| Workstream | Hours |
| --- | ---: |
| Framework setup | 5–7 |
| Database and seed data | 5–6 |
| Document processing | 5–7 |
| AI extraction | 7–9 |
| Graph and UI | 8–10 |
| Risk analysis | 5–6 |
| Handover | 4–5 |
| Verification | 5–7 |
| Agent integration | 4–6 |
| Testing/deployment/demo | 7–9 |

Protect the scope. No external integrations, no production infrastructure access, no complex permissions, no unnecessary features.

---

## 16\. ACCEPTANCE CRITERIA

Before submission, verify:

1. Uploading a runbook saves extracted text and evidence.
2. Knowledge extraction creates or matches people, systems and processes.
3. Opening Alex's profile shows correct relationships.
4. Asking about Alex's departure returns evidence-linked risks.
5. Editing a finding updates the database and UI.
6. Generating a handover plan creates real task records.
7. Blocking a verification step saves the blocker.
8. Finalizing a failed test does not mark the procedure ready.
9. Human corrections persist and appear in the activity log.
10. Refreshing the browser preserves workspace data.
11. Agent actions and UI actions use the same underlying capabilities.
12. Public demo is accessible without login or access-request friction.

---

## 17\. INSTRUCTIONS TO CODEX

Act as a senior full-stack engineer and technical collaborator.

We are building a real hackathon product, not a mockup.

Follow these rules:

1. First inspect the existing project and installed Agent-Native version.
2. Read the relevant framework documentation and starter examples.
3. Do not assume APIs, imports, configuration names or folder structures.
4. Preserve working starter functionality.
5. Use TypeScript strictly.
6. Use Zod validation for shared action contracts.
7. Keep domain logic separate from UI components.
8. Make the agent and UI share the same application actions and persisted state.
9. Build incrementally and run the app after each meaningful milestone.
10. Do not leave buttons or screens as nonfunctional placeholders.
11. Do not hardcode dashboard metrics when database-backed data is available.
12. Seed the fictional demo organization consistently.
13. Use realistic, internally consistent sample documents.
14. Keep AI outputs structured and evidence-backed.
15. Never fabricate verification outcomes.
16. Never expose secrets in frontend code.
17. Do not overengineer.
18. Do not implement out-of-scope integrations.
19. Prefer the framework's supported conventions over custom infrastructure.
20. Explain significant architecture decisions and trade-offs.

### FIRST TASK

Do not attempt to build the entire product immediately.

Start by:

1. Inspecting the current repository.
2. Checking Node.js, pnpm and package versions.
3. Reading the installed Agent-Native starter structure and documentation.
4. Identifying how OpenAI is configured.
5. Identifying how shared actions are defined, invoked from React, and exposed to the agent.
6. Identifying the database and migration approach.
7. Reporting the actual architecture and any gaps between this brief and the installed framework version.
8. Proposing the smallest proof-of-concept implementation.

Then implement one action called `getWorkspaceContext` that can be invoked by both the React UI and Continuity Analyst and returns the same persisted Northstar Digital workspace data.

Run and test it before proceeding.

**The first milestone is a working Agent-Native + OpenAI + shared-action foundation. Everything else comes after that.**
