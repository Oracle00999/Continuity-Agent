# Run Continuity locally

Continuity helps an engineering team understand documented responsibilities,
review source-backed handover risks, and prepare a departure plan. The agent
and interface use the same actions and SQL records. Claims, risk proposals and
suggested assignments require human review; the app does not execute recovery
operations or invent test results.

## Prerequisites

- Node.js 22.22 or later and pnpm 10.29.1.
- An OpenAI API key for the Analyst. Local records and navigation work without
  inference, but extraction, risk assessment and plan drafting need the provider.

## Setup

```sh
git clone https://github.com/Oracle00999/Continuity-Agent.git
cd Continuity-Agent
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Set `OPENAI_API_KEY` in your local `.env` before starting the server. Never put
keys in browser code or commit them. Authentication remains enabled by default;
follow the sign-in screen or the framework's local development sign-in flow.
Use the URL printed by the server (normally `http://localhost:8080`).

Open **Workspace** and choose **Load demo workspace** to create the fictional
Northstar Digital team and six systems. Upload the included
[handover PDF](../output/pdf/Northstar-Digital-Operations-Handover.pdf) in
**Documents**, then follow the [demo walkthrough](DEMO_WALKTHROUGH.md).
The overview is the authenticated landing page. Chat and contextual Analyst
assistance remain available throughout the app.

## Project map

| Location | Purpose |
| --- | --- |
| `actions/` | Validated operations shared by the agent and UI |
| `app/` | Routes, domain UI and shared-shell adapters |
| `server/domain/` | Scoped operations and validation |
| `server/db/` | PostgreSQL-compatible Drizzle schema |
| `server/plugins/db.ts` | Reviewed additive app migrations |
| `shared/` | Contracts shared by server and client |
| `tests/`, `scripts/` | Regression tests and local smoke checks |
| `docs/` | Feature contracts and development guidance |

## Checks

```sh
pnpm typecheck
pnpm agent-native:doctor
pnpm test
```

The browser tests require installed Google Chrome, a running server and the
documented seeded test fixtures. Live-agent checks contact the configured
provider and save QA chats. See [visual testing](VISUAL_TESTING.md) before
running those separately.

Local PGlite, uploaded originals, credentials, diagnostic output and generated
demo media are excluded from Git. Preserve these locally when updating source.
The included PDF is fictional and safe to use as sample input.

## Hosting

Netlify configuration is provided, but deployment is optional. A hosted app
needs persistent PostgreSQL, private persistent file storage, provider setup,
a stable authentication secret and trusted origins for its actual domain.
No live deployment is implied by this repository. The release migration script
applies framework migrations followed by the app's migration plugin.

## Framework attribution

The app starts from the Agent-Native Chat template and retains its shared
authentication, chat, settings, navigation, Toolkit controls and action runtime.
Continuity adds the handover data models, document evidence, extracted claims,
knowledge map, risk register, draft plans, human verification and overview.
