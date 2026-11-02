# Visual browser testing

Run `pnpm test:visual` while the existing development server is running at
`http://localhost:8080`. Do not start a second server against the same PGlite
directory. Google Chrome must be installed. The runner targets the local server
on port 8080.

The Playwright runner launches isolated, headless Chrome contexts. It signs in
through the framework's local development authentication endpoint and does not
use a personal browser profile. It does not export cookies or authentication
state; traces and videos are disabled.

The suite requires the current seeded Northstar Digital workspace, its saved
backup runbook, extracted knowledge, proposed backup-location risk, and Alex's
unapproved handover plan. It checks the authenticated landing, person selection,
document panels, map selection and zoom, unsaved review form, plan/task links,
and verification checklist at desktop (1440 × 1000) and mobile (390 × 844) sizes.
It checks horizontal overflow and uncaught browser errors. It does not approve
plans, save reviews, or record procedure results.

Screenshots are written to `.tmp/visual/screenshots/`, with an HTML report at
`.tmp/visual/report/index.html`. These local artifacts may contain workspace
content and are ignored by git. Review screenshots directly; passing interaction
assertions alone do not establish visual quality.

On October 31, 2026, all 14 checks passed against the local development server.
All 14 passed again on November 1, 2026 (1.7 minutes).
Screenshot review prompted a two-column mobile summary layout and a corrected
singular task label. These checks cover the domain screens; live model chat,
suggestion keyboard handling, cancellation, and concurrency are separate tests.

## Live suggestion keyboard check

`scripts/test-live-chat-browser.mjs` prepares a separate live check. It sends a
read-only QA prompt, selects an explanatory suggestion, checks that focus returns
to the composer, and presses Enter to check for an unintended extra submission.
It saves screenshots under `.tmp/visual/live-chat/`.

This contacts the configured model provider with the app's normal workspace
context and persists a QA chat thread. After explicit approval, run:

```sh
node scripts/test-live-chat-browser.mjs --approved-live-chat
```

On November 1, 2026, the user explicitly approved the context transfer and saved
QA thread. The live desktop check passed: suggestion selection returned focus to
the composer, the following Enter produced no additional submission, and no
uncaught browser JavaScript errors were reported. The resulting screenshot was
reviewed. Cancellation and concurrency are covered by the separate check below.

## Chat cancellation and overlapping runs

After approval for the same model context transfer and QA thread persistence:

```sh
node scripts/test-chat-lifecycle-browser.mjs --approved-live-chat
```

This isolated desktop browser check verifies authenticated landing, observes an
active reply, attempts a second direct run, checks the expected HTTP 409
`run_slot_busy`, clicks the real Stop response button, verifies the run becomes
inactive, and submits a new message that must finish with `READY`. Direct-run
rejection is distinct from the framework's supported UI follow-up queue.
Prompts request no tools or business-data changes. Cleanup stops any remaining
run belonging to the QA thread, including after an assertion fails.

On November 1, 2026, the first attempt passed overlap rejection and cancellation
but the recovery reply exceeded 120 seconds while the runtime displayed model
retry messages. A complete repeat passed all checks, including the recovery
reply, with no browser JavaScript errors. This establishes successful recovery
in the repeated run; it does not establish that model timeouts cannot recur.
Screenshots and the passing result are in `.tmp/visual/chat-lifecycle/`.

## Deployment verification

The user confirmed on November 1, 2026 that the app has not been deployed.
Hosted authentication, database persistence, private file storage, migrations,
and live chat therefore remain unverified. The local tests do not substitute
for those checks. The existing Netlify configuration and release migration
script are present; no production build, release migration, or deployment was
run during these checks.

Before hosted testing, configure persistent PostgreSQL, private persistent file
storage, a stable authentication secret, the final site's authentication origin,
and the app's model provider credentials. `netlify.toml` currently lists starter
Agent-Native trusted origins; review these against the actual deployed domain.
The production smoke must use real authentication, not the local-dev sign-in
endpoint used by these local scripts. Verify the demo workflow, reload saved
records and sources, then repeat chat cancellation/recovery on that host.
