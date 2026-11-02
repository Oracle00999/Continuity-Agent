# Departure handover plans

Open **Departure handover** (`/handover`) or follow **Include in departure handover** from an unresolved finding. Choose the departing person and source risks, then **Draft handover plan**. The visible Analyst reads the saved findings and team, and persists one proposed task per selected finding. Owners and dates are suggestions, not commitments. Missing values remain clearly labelled.

Review the task descriptions, priorities, owners and dates. **Review or edit task** opens the existing shared task editor. Suggestions can be removed before approval. **Approve plan and assignments** requires an explanatory note, at least one task, and an owner and deadline on every suggestion. Approval confirms assignments only; tasks stay unstarted and risks/tests/readiness remain unchanged. No teammate notifications are sent. To propose additional tasks after approval, explicitly reopen the plan. Previously confirmed assignments stay confirmed; new suggestions require approval. Confirmed tasks can still be managed through the task editor but cannot be removed by the suggestion-removal action.

| Shared action | Purpose |
| --- | --- |
| list-handover-plans | List private plans in the authorized workspace (100 with hasMore). |
| get-handover-plan | Read plan and up to 100 persisted tasks, including descriptions and risk links. |
| draft-handover-plan | personId and 1–30 selected risk-linked proposals atomically; title, description, priority, suggested assigneeId/dueDate (nullable). |
| review-handover-plan | id, current revision, approve/reopen, notes. Requires explicit user intent. |
| remove-handover-plan-task | Suggested task id/current revision/reason; draft plans only. |
| update-handover-task | Existing shared editor now supports descriptions/priorities and optional owner/date only on suggestions. |

One plan exists per workspace/person and one plan task per finding. Draft retries/additions preserve existing edits and return insertedCount. Rejected/resolved findings and findings explicitly related to another person are refused on drafting. Each task retains its original assessment/action snapshot, first cited source document, and finding link; the finding retains all evidence. Older verification-gap tasks remain confirmed standalone assignments with their original test-step source. They are not automatically merged with risk-derived plan tasks.

Migration v8 adds plans and extends the existing task table with nullable source variants, plan/finding foreign keys, description, priority and assignment status. Existing rows retain confirmed assignments. Source-origin and confirmed-owner/deadline checks protect integrity. Every read/write scopes owner, org and workspace. Task edits and plan review use the same parent lock order; task edits bump the plan revision, so approval cannot race with stale owner/date edits. Draft task/evidence references and audit events commit atomically. Approval never accepts findings or passes tests; completing tasks still requires explicit updates and relevant human retests.

Plan generation stays in the app agent chat; shared domain actions are deterministic. The same task rows are visible on the plan and Tasks screen. Navigation view is handover; activeHandoverPlanId, selectedPersonId and selectedFindingIds describe selection. view-screen returns saved plans, the selected/default departure plan and relevant risk data. Primary plan tools are initially available to the Analyst. Internal IDs remain in context and link targets, not labels.

Verification uses real PGlite SQL in an isolated in-memory database (tests/handover-plans.integration.test.ts), applying all production migration entries. It covers concurrent drafting/deduplication, missing-assignment rejection, stale approval, approval racing an owner edit, explicit approval, reopening with confirmed assignments preserved, removing suggestions, scope, unchanged risks/tests, and legacy verification tasks. Two focused UI tests cover nullable dates/owners, no automatic approval, readable labels and protected confirmed work. Four focused tests passed. Local read-only HTTP checks verify migration compatibility/auth/route without test approvals in the demo workspace. The live Analyst check persisted a real draft task from only the unchanged fictional restore fixture and its untouched risk; it did not approve, complete, or alter the risk.

Limits: 100 tasks per plan; one task per finding; no automatic cross-source task merging, reminders, external messages or readiness reconciliation. Date suggestions need human review; deadlines after departure are flagged rather than prohibited.

Final typecheck and Agent-Native doctor passed. Visual browser QA remains pending because the installed browser connection fails with `Cannot redefine property: process`.
