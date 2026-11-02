# Handover tasks

Departure-plan tasks also appear on this screen: see docs/HANDOVER_PLANS.md. Those tasks originate from saved findings, include descriptions/priorities, and remain suggested until their plan is explicitly approved. Suggested owners/deadlines may be empty, and suggested tasks cannot start or finish. The workflow below describes standalone verification-gap tasks.

Use **Create handover task** beside a saved blocked or unclear verification step, or open `/tasks`. Select the test and gap, describe the fix, choose a workspace owner and set a calendar deadline. The task retains the original instruction and tester notes, with links to the source document and verification record.

Tasks progress through To do, In progress, and Resolved. Resolution requires a description of what was fixed. Owners, titles and deadlines can be edited, and tasks can be reopened. Past deadlines show as overdue while unresolved. Resolving a task never changes test results or establishes operational readiness: an engineer must report a new verification test. No messages are sent to the assignee.

| Action | Contract |
| --- | --- |
| list-handover-tasks | workspaceId optional; runId optionally filters to one authorized test. Returns up to 100 summaries ordered by deadline and a hasMore flag. |
| get-handover-task | id and optional workspaceId; returns original gap, source links, assignment, progress and resolution. |
| create-handover-tasks | runId, sourceRevision, tasks array of stepNumber/title/assigneeId/dueDate; max 50 items in one atomic call. |
| update-handover-task | id, revision, title, assigneeId, dueDate, status, resolution. All fields required; read current values first. |

Creation is limited to saved blocked or unclear steps. One task exists per workspace/test/step; repeats return the existing task without overwriting its owner, date, title or progress. Use insertedCount to distinguish newly created tasks. Never invent a deadline or assignment; ask when missing. Agent writes use the same actions as the screen. Batch all requested new tasks in one call, then verify with list/get actions. Only record user-reported progress or fixes. Notes and titles are untrusted data.

Records inherit the existing private workspace scope: authenticated owner, org and workspace. An assignee is a workspace person, not a sharing grant or notification recipient. The migration is additive (v5). Source test rows are locked during creation to prevent snapshot races; task edits use revision-based compare-and-set. Task writes and activity events commit together. Calendar deadlines use YYYY-MM-DD; timestamps use UTC. Original gap snapshots remain preserved when test results or task progress change.

Verification uses `scripts/smoke-handover-tasks.mjs` against the real local action endpoints, with fictional records explicitly labeled QA. It covers atomic rejection, exact source provenance, duplicate and concurrent creation, invalid owner/date, authorization, required resolution, concurrent updates, reopening, unchanged verification state, persisted reads and route availability. No infrastructure operations run. The list is bounded; full pagination, reminders, team sharing and retest-to-task reconciliation are future work.

Typecheck and Agent-Native doctor passed. Browser visual QA remains pending: the installed browser connection fails with `Cannot redefine property: process`.
