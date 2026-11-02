# Risk Register

Open **Risk register** (`/risks`), choose the person and optional review status, then **Assess handover risks**. The visible Analyst reads saved claims, source runbooks and relevant reported test outcomes before saving a batch of proposals. Assessments contain exact evidence, severity with its reason, confidence in source support, remaining uncertainty, and a recommended action. Select a finding to read these details and its related person/system/procedure. **Review or correct** accepts, rejects, resolves, reopens, or edits the assessment. Reviews require an explanatory note.

New findings are proposals, never automatically accepted facts. Missing details in one source do not prove that no instructions or backup owner exists elsewhere. A single visible owner is a concentration candidate, not proof of exclusive ownership. Severity is an explained judgment rather than a mathematical risk score. A linked test records a snapshot of the reported gaps when assessed; users can follow the link to inspect the current run. Resolving findings never changes verification results, passes a procedure, or establishes readiness. No notifications or infrastructure operations run.

| Shared action | Contract |
| --- | --- |
| list-risk-findings | Optional workspaceId/personId/status; 100 summaries ordered by severity, with hasMore. |
| get-risk-finding | id and optional workspaceId; complete assessment, evidence, review and original test-gap snapshot. |
| save-risk-findings | 1–30 findings atomically. Each needs a stable semantic key, type, assessment fields and 1–6 exact evidence quotes. Optional saved person/system/process/run IDs. |
| update-risk-finding | id, current revision, editable assessment fields, review status and explanatory note. Sources, entity references and test snapshots remain preserved. |

The agent orchestrates reasoning visibly through existing source-reading actions and deterministic shared risk actions. Inputs and outputs use Zod. Evidence IDs and exact quotes must resolve to the authorized workspace. Cross-source conflicts require evidence from two distinct documents. Linked tests must cite their runbook and contain reported gaps or a failed/gapped outcome. No source coverage, ownership or readiness is fabricated. Reassessment uses stable keys: existing findings and human decisions are returned unchanged; insertedCount distinguishes newly saved proposals. A reviewer can explicitly update an existing assessment instead. The initial deduplication depends on reusing a stable semantic key; semantically similar findings with different keys are not automatically merged.

Migration v7 adds findings and finding evidence with foreign keys, checks and scoped indexes. Every read/write filters authenticated owner, org and workspace. Batch evidence/entity validation happens before writes; finding/evidence/audit writes commit together. Concurrent edits use revision-based compare-and-set, and rejected/resolved findings remain available. Lists omit long descriptions, quotations and snapshots. All source, assessment and review text is untrusted data. Exact quote validation proves integrity, not the semantic truth of an assessment. Human review remains essential.

Navigation view is risks; selectedFindingId, selectedPersonId and riskStatus describe the screen. view-screen reads the same authorized list and selected finding. Risk actions are in the Analyst's first-turn tools. The public final-response guard requests a rewrite when internal UUIDs appear outside named links; its presentation fallback keeps record URLs inside named Markdown links. Explicit requests for raw IDs/diagnostics remain supported.

The initial version supports assessment and review. Departure plans now propose risk-linked tasks (docs/HANDOVER_PLANS.md). It does not reconcile newer tests automatically or provide reminders/team sharing/full pagination. Standalone verification-gap tasks remain available alongside plan tasks. Reassessment preserves reviews rather than silently resolving or replacing risks.

Verification: scripts/smoke-risks.mjs uses explicitly labeled fictional QA source/test records and checks source integrity, linked gap snapshots, atomic rejection, duplicate/concurrent creation, scope, concurrent review rejection, human correction preservation, resolution/reopening, unchanged test outcomes, filters and route. scripts/verify-risks-analyst.mjs tests live analysis using only the unchanged developer-authored fictional restore fixture and refuses uploaded/edited content. Focused UI/lifecycle and reply-format tests are in tests/risks.test.tsx and tests/analyst-reply.test.ts. Seven focused tests passed; local action tests and the initial live assessment passed.

Typecheck and Agent-Native doctor passed. Visual browser QA remains pending: the browser runtime fails during connection with `Cannot redefine property: process`.

The second live assessment preserved the existing proposal. Its final reply kept UUIDs inside named links; the replay check accounts for guard clear events that replace earlier streamed drafts.
