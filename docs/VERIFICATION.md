# Human procedure verification

The Verification screen (`/verification`) records a human tester's observations. It never provisions environments, obtains approvals, fetches backups, executes commands, or validates infrastructure evidence automatically.

| Action | Use |
| --- | --- |
| list-verifications | Read saved tests in the authorized workspace. |
| get-verification | Read a test by id, including exact source instructions and saved results. |
| start-procedure-verification | Select documentId and testerId; pass a stable UUID requestId for safe retries. |
| record-verification-steps | Batch explicitly reported results with notes, id and current revision. |
| finalize-verification | Save the requested outcome and summary with current revision. |

Only record what the user explicitly reports from the tester. Never manufacture observations or infer execution from a runbook. Verify writes with get-verification. Navigation includes selectedRunId; view-screen reads the selected test. Navigate using the returned urlPath.

Tests snapshot the source name, content hash, exact numbered lines, tester, and timestamps. The initial version supports runbooks containing numbered instruction lines, up to 100 steps. It does not rewrite source instructions or resolve missing prerequisites. Finalized tests are immutable; retests create new records. Every recorded result requires notes. Pending results prevent finalization; blocked results require a failed outcome; unclear results prevent a pass. A pass records the human's report, not independently authenticated evidence, confirmed ownership, or overall handover readiness.

Records inherit the existing private workspace scope (authenticated owner, org, workspace). The selected tester is a named workspace person, not an authenticated attestation by that person. recordedBy tracks the actual signed-in recorder. Writes and activity events are atomic. Revisions reject concurrent or stale edits. Start requests are idempotent by workspace/requestId.

Verification: pnpm typecheck and pnpm agent-native:doctor; scripts/smoke-verification.mjs exercises real authenticated action HTTP calls, six source steps, duplicate starts, authorization, incomplete and blocked rejection, concurrent revisions, finalization immutability, persisted reads, and the route. Its saved records are explicitly labeled synthetic QA; no restoration was performed. Browser visual testing is pending because the installed browser runtime fails during connection (Cannot redefine property: process).
