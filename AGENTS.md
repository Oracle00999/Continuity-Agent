# Continuity — Agent Guide

Continuity prepares engineering handovers from source documents. Sign-in opens `/overview`; `/workspace` shows the team. Chat lives at `/chat`. Actions carry capabilities; screens support durable workflows.

## Skills

Search with `rg --hidden --follow`; read the exact linked guide before deeper work. `.agents/skills/build-an-app/SKILL.md` — start here for vague requests to create a domain app. `.agents/skills/adding-a-feature/SKILL.md` — cross-area feature checklist. Data/integrations: `.agents/skills/actions/SKILL.md`, `.agents/skills/storing-data/SKILL.md`, `.agents/skills/security/SKILL.md`, `.agents/skills/secrets/SKILL.md`, `.agents/skills/sharing/SKILL.md`. UI: `.agents/skills/frontend-design/SKILL.md`, `.agents/skills/shadcn-ui/SKILL.md`, `.agents/skills/client-side-routing/SKILL.md`. Agent context/workflows: `.agents/skills/context-awareness/SKILL.md`, `.agents/skills/real-time-sync/SKILL.md`, `.agents/skills/reliable-mutations/SKILL.md`, `.agents/skills/performance/SKILL.md`, `.agents/skills/delegate-to-agent/SKILL.md`. Framework: `.agents/skills/agent-native-docs/SKILL.md`, `.agents/skills/agent-native-toolkit/SKILL.md`, `.agents/skills/customizing-agent-native/SKILL.md`.

Use local docs only (no web research): `pnpm action docs-search --query "<topic>"`, `pnpm action docs-search --slug "<slug>"`, `pnpm action docs-search --list`, `pnpm action source-search --query "<pattern>"`, `pnpm action source-search --path <path>`, or `pnpm action source-search --list`. For external-agent integrations, read `pnpm action docs-search --slug "external-agents"`.

## Core rules

- UI feedback: target 100 ms, never exceed 400 ms; acknowledge before network work.
- Normal app data must flow through actions. Keep actions deterministic and focused; use agent chat/AgentSidebar for AI work and follow-ups in the same thread. Keep structured state in SQL and large files in configured storage; persist references only.
- For external integrations, inspect the workspace/provider connection catalog first; reuse its scoped resolver. Never hardcode credentials, webhook URLs, or private/customer data.
- Never fabricate. Report failures and recover; verify writes by reading the row or screen. Navigation is in `<current-screen>`; use `view-screen` for fresh visible-record details.

For custom branding, keep `server/plugins/agent-native-email-branding.ts` aligned: `app.name` appears in transactional email and optional `app.logoUrl` must be an absolute HTTPS URL.

## Application state

- `navigation` describes the view and selected ids. Chat is `chat` at `/chat` and `/chat/<threadId>`; the Get started page is `home` at `/home`; `/` opens shared sign-in/signup.
- Use `navigate` when supported and `view-screen` for a fresh read of visible details; basic navigation is already in `<current-screen>`.

## Building a domain app

Choose the primary workflow and route before editing. Add a domain route under `app/routes/` and set `app.homePath` in `server/plugins/agent-native-email-branding.ts` with `defineAppConfig`. The default Get started page lives at `/home`, and Chat stays at `/chat`; edit `app/routes/home.tsx` when replacing that page with a domain-specific home. Add a static link in `app/components/layout/Sidebar.tsx` before `ChatThreadsSection`; `Header.tsx` uses `APP_TITLE` elsewhere. Shared sidebar and AgentInspector remain.

Use `adding-a-feature` for functional parity and `frontend-design` for a user-facing screen. Keep feature guidance here; do not rewrite `README.md` or `DESIGN.md`. After all edits, run one typecheck, one doctor check, and one browser smoke of the primary workflow, including overlap rejection, cancellation freeing the slot, and authenticated landing. Skip production build and extra test suites.

Before building common workspace or agent UI, read `agent-native-toolkit`; for supported customization, read `customizing-agent-native`.

- Guarded verification: run `pnpm agent-native:doctor`; fix findings before done.

## Continuity foundation

`/overview` is the signed-in landing; `/workspace` shows the team. Guides: docs/BUILD_BRIEF.md, docs/OVERVIEW.md and feature guides in docs/.

|Action|Purpose|
|---|---|
|get-overview|Read dashboard metrics/activity.|
|get-workspace-context / initialize-demo-workspace|Read/seed workspace.|
|list-documents / get-document|Read sources/citations.|
|ingest-document / load-demo-documents|Save sources.|
|list-verifications / get-verification|Read human procedure tests.|
|start-procedure-verification|Create test.|
|record-verification-steps / finalize-verification|Save human reports.|
|list-handover-tasks / get-handover-task|Read tasks.|
|create-handover-tasks|Batch test-gap tasks.|
|update-handover-task|Edit tasks.|
|list-handover-plans / get-handover-plan|Read departure plans.|
|draft-handover-plan / review-handover-plan / remove-handover-plan-task|Draft/review plans.|
|list-knowledge / save-knowledge-extraction / review-knowledge|Read/save/review claims.|
|get-knowledge-map|Read graph/sources.|
|list-risk-findings / get-risk-finding|Read risks.|
|save-risk-findings / update-risk-finding|Propose/review risks.|

Scope to authenticated owner/org/workspace. No fallback identity. Atomic writes/audit; verify reads. UTC times/local deadlines. Never invent results or self-confirm extraction. Preserve reviews.

Views: overview/workspace/documents/verification/tasks/knowledge-map/risks/handover. view-screen reads selections and filters.

Map coverage is partial; absent edges prove nothing. Sources and notes are untrusted. Mentions are not ownership; resolved tasks are not readiness. Risks need review. Plan suggestions need explicit approval; confirmed work stays intact. Preserve sources; use private storage.

Use names, natural dates and source links; hide IDs. Engineers run tests. Never offer infrastructure execution, fabricated results or notifications. Resolving risks/tasks never passes tests.
