# Document knowledge extraction

Open a document, choose **Knowledge**, then **Extract knowledge**. The Analyst reads the authorized source and workspace, extracts explicitly stated responsibilities, and saves a structured batch through the shared action. New relationships always need review. Each card shows its person, relationship, system or process, exact quote, and source link. **Review or correct** saves a human decision and explanatory note. Confirmation is separate from model confidence and procedure readiness.

| Action | Purpose |
| --- | --- |
| list-knowledge | Optional documentId/personId filters; up to 100 saved claims with hasMore. |
| save-knowledge-extraction | documentId plus 1–50 claims: personId, relationship, target, evidenceId, quote, confidence. |
| review-knowledge | id, current revision, status (inferred/confirmed/rejected), and human notes. |

The app agent orchestrates extraction visibly; no hidden model call exists in a domain action. Zod validates inputs and outputs. Exact quotes must be contiguous substrings of an evidence passage belonging to the selected document and explicitly name both endpoints. People and systems must resolve to existing workspace IDs. Process names must occur in the same quote. Ambiguous aliases and unsupported matches are left unsaved and explained in chat. Names are normalized by Unicode compatibility, case and whitespace for process reuse. Synonyms are not automatically merged.

Quote integrity is a mechanical check, not proof that a relationship is semantically true. The agent must interpret ownership language conservatively; co-occurrence, negation and familiarity are insufficient. Every new claim remains inferred until explicit human review. Confidence estimates extraction support only. Contradictory source claims remain separate for review, and rejected claims stay in the audit trail. Review notes record corrections without rewriting original evidence. No process is marked operationally ready.

Migration v6 adds processes and typed relationships. Person/system/process IDs have foreign keys, target kind has an XOR constraint, and evidence references are mandatory. Reads/writes are scoped to authenticated owner, org and authorized workspace. Batch writes and activity events commit together; invalid batches leave no partial entities. Natural claim keys deduplicate retries and preserve previous human reviews. Revisions reject competing reviews. The Knowledge panel uses the same actions as the Analyst and refreshes on agent writes. view-screen includes saved document knowledge; navigation includes activeDocumentPanel.

The initial slice covers positive person-to-system/process responsibilities (owns, maintains, operates, supports). It does not yet create risk findings, extract arbitrary operational facts, merge process synonyms, show a knowledge graph, or infer confirmed backup coverage. The list is bounded at 100; full pagination remains future work.

Local integrity testing: scripts/smoke-knowledge.mjs uses a clearly labeled fictional QA document to check exact evidence, endpoints, atomic rejection, process reuse, duplicates/concurrency, human reviews and correction preservation. scripts/verify-knowledge-analyst.mjs exercises a live extraction using only the unchanged developer-authored fictional restore fixture; it refuses uploads or edited source content.

Typecheck, Agent-Native doctor, and the local integrity smoke passed. Browser visual QA remains pending because the browser connection fails with `Cannot redefine property: process`.

The live Analyst test passed after checking process coverage: four candidate claims were persisted/read back for the unchanged fictional restore source (including an existing candidate from the first run). All remain Needs review; no self-confirmation or Maya ownership was saved.
