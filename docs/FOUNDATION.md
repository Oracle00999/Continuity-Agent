# Continuity foundation

Current landing: `/overview` (see [OVERVIEW.md](./OVERVIEW.md)); `/workspace` remains the team/system view.

This records the original foundation milestone. The subsequent document/evidence implementation is described in [DOCUMENTS.md](./DOCUMENTS.md).

This milestone proves a persisted workspace and the shared UI/agent action boundary. The broader discovery, assessment, handover, and verification workflows come after this proof.

The original requirements are preserved in `docs/BUILD_BRIEF.md`. Its deadline conversion needs correction: November 9, 2026 at 11:59 PM Pacific is November 10 at **8:59 AM Nigeria time**. The effort table adds up to 61–82 hours.

## Installed architecture

- Agent-Native Core, AgentKit, and Toolkit 0.222.2, from the standalone Chat starter.
- React Router 8, React 19, TypeScript in strict mode, Tailwind 4, Zod 4.
- PostgreSQL-compatible Drizzle schema in `server/db/schema.ts`; local singleton in `server/db/index.ts`.
- Local PGlite storage at `data/pglite`, excluded from Git. Hosted environments need a PostgreSQL `DATABASE_URL`.
- The Chat starter has no Drizzle Kit configuration. Named, reviewed SQL migrations run through `runMigrations` in `server/plugins/db.ts`; the existing production release script applies this plugin.
- The React screen calls `useActionQuery` and `useActionMutation`. Agent-Native discovers one default action per kebab-case filename in `actions/`, generates client types, and exposes those same actions as agent tools.
- `server/domain/workspace.ts` owns data access and seed transactions. UI components contain no independent business persistence.
- The existing chat, authentication, settings, and persistent application shell remain available. `/workspace` is the signed-in landing screen; `/home` remains the starter help page.

## Shared capabilities

`get-workspace-context` implements the brief's `getWorkspaceContext`. It validates inputs and outputs, authenticates the caller, checks owner and active organization, authorizes the workspace, and returns its saved people and systems. A requested inaccessible workspace produces a generic 404. Invalid cross-workspace person selection is rejected.

`initialize-demo-workspace` creates the fictional Northstar Digital workspace, five people, six systems, and one audit activity in a transaction. A unique demo key prevents duplicates under repeated or concurrent calls. It preserves the original departure date and records. Other future workspaces can use a null demo key.

The seed workspace is private to its owner and active organization for this foundation. Team membership and organization-wide sharing are not implemented yet. Child rows include explicit tenant columns as well as workspace foreign keys. No development identity fallback exists in domain code.

The existing route-state hook exposes `workspace`, `activeWorkspaceId`, and `selectedPersonId`. The selected person lives in the URL. `view-screen` resolves these IDs against the same domain read service. The Analyst's first-turn tools include both workspace actions.

## OpenAI configuration

The installed starter already includes the AI SDK OpenAI provider. Use its shared model settings and credential UI; no custom credential form or second model loop is needed.

For local development, `.env` sets `AGENT_ENGINE=ai-sdk:openai` and `DATABASE_URL=pglite:./data/pglite`. The server-side app configuration defaults to the tested `gpt-5-mini` model; users can change models through shared Settings. The server-only `OPENAI_API_KEY` is configured locally and excluded from Git. Never use a Vite-prefixed key. The runtime prompt identifies the agent as Continuity Analyst and limits claims to saved data.

## Proof and verification

Start `pnpm exec agent-native dev`, run `pnpm typecheck`, then `pnpm agent-native:doctor`. `node scripts/smoke-foundation.mjs` checks the actual HTTP and CLI action transports against the running local server: five people, six systems, repeat-safe setup, selection, authentication, and owner/org isolation.

`node scripts/verify-analyst.mjs` runs one real OpenAI app-agent loop against the saved snapshot after the dev server is stopped. It starts the CLI with Node's `--import tsx` loader, matching the action runner's TypeScript import resolution. The bare `agent-native agent` command on Node 24 otherwise skips source actions whose imports use emitted `.js` extensions. The script confirms a successful `get-workspace-context` tool event and matching workspace/person IDs. Evidence is saved under the Git-ignored `.tmp/` directory.

For the browser proof, open `/workspace`, select Alex, and choose **Ask Continuity Analyst**. Confirm the tool trace calls `get-workspace-context` and the response contains the same workspace and person IDs shown on the page. The current browser tool failed during bootstrap (`Cannot redefine property: process`), so visual and interaction smoke testing remains outstanding. HTTP reads, the CLI, and the live model were exercised independently; this does not substitute for that browser check.

Document extraction, evidence, ownership relationships, findings, handover tasks, and procedure verification are intentionally outside this milestone. The UI and Analyst explicitly say that ownership and readiness have not been assessed.

## Differences from the brief

- Action names use the framework's kebab-case filename convention.
- This Chat starter uses named migration entries, not generated Drizzle Kit migrations.
- The framework's preferred approach keeps actions deterministic and lets the visible agent orchestrate reasoning. The brief's proposed analysis and generation actions will need focused persistence contracts and deliberate orchestration rather than a separate hidden agent runtime.
- Local PGlite is appropriate for this proof. Shared deployment needs hosted PostgreSQL.

## Verified on October 30, 2026

- TypeScript strict checks passed.
- Agent-Native Doctor passed with no findings.
- Real HTTP and CLI reads matched the same five people and six systems.
- Repeated initialization preserved records, IDs, and departure dates.
- Authentication, owner isolation, organization isolation, and invalid person selection checks passed.
- After a full server restart, the saved workspace matched the previous snapshot exactly.
- A live OpenAI `gpt-5-mini` run completed `get-workspace-context`. Its entire tool result exactly matched the HTTP snapshot, including the selected Alex record.
- Browser interaction/visual testing is outstanding due to the browser tool bootstrap error described above. No production build or deployment was attempted in this milestone.
