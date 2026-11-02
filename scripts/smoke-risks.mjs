import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:8080";
const signIn = await fetch(`${base}/_agent-native/auth/local-dev`, {
  method: "POST",
});
assert.equal(signIn.status, 200);
const cookie = signIn.headers
  .getSetCookie()
  .map((value) => value.split(";")[0])
  .join("; ");
assert.ok(cookie, "Local development sign-in must issue a session");

async function action(name, input = {}, method = "GET", session = cookie) {
  const url = new URL(`/_agent-native/actions/${name}`, base);
  if (method === "GET")
    for (const [key, value] of Object.entries(input))
      url.searchParams.set(key, value);
  const response = await fetch(url, {
    method,
    headers: {
      cookie: session,
      origin: base,
      ...(method === "GET" ? {} : { "content-type": "application/json" }),
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(input) }),
  });
  return { status: response.status, body: await response.json() };
}
const workspace = await action("get-workspace-context");
assert.equal(workspace.status, 200);
assert.ok(workspace.body.workspace, "Load the Northstar workspace first");
const workspaceId = workspace.body.workspace.id;

const sourceText =
  "# Risk Register QA\n\nAlex Morgan owns the PostgreSQL database recovery procedure.\n\n## Restore\n\n1. Obtain approval for an isolated recovery target.\n2. Retrieve the completed backup from Backup storage.\n\nSynthetic QA only; no infrastructure operations performed.\n";
const form = new FormData();
form.set("workspaceId", workspaceId);
form.set("file", new File([sourceText], "Risk Register QA.md"));
const staged = await fetch(`${base}/api/document-upload`, {
  method: "POST",
  headers: { cookie, origin: base },
  body: form,
});
assert.equal(staged.status, 201);
const ingested = await action(
  "ingest-document",
  { workspaceId, attachmentRef: (await staged.json()).attachmentRef },
  "POST",
);
assert.equal(ingested.status, 200, JSON.stringify(ingested.body));
const doc = ingested.body.document;
const alex = workspace.body.people.find((p) => p.name === "Alex Morgan");
const maya = workspace.body.people.find((p) => p.name === "Maya Chen");
const db = workspace.body.systems.find((s) => s.name === "PostgreSQL database");
const runCreated = await action(
  "start-procedure-verification",
  {
    workspaceId,
    documentId: doc.id,
    testerId: maya.id,
    requestId: crypto.randomUUID(),
  },
  "POST",
);
assert.equal(runCreated.status, 200);
const report = await action(
  "record-verification-steps",
  {
    workspaceId,
    id: runCreated.body.run.id,
    revision: 0,
    results: [
      {
        number: 2,
        result: "blocked",
        notes:
          "Synthetic QA only: location missing from example runbook; no restore performed.",
      },
    ],
  },
  "POST",
);
assert.equal(report.status, 200);
const run = report.body.run;
const e = doc.evidence.find((p) =>
  p.quote.includes("Retrieve the completed backup"),
);
assert.ok(e);
const finding = {
  key: `qa-backup-${crypto.randomUUID()}`,
  type: "documentation_gap",
  title: "[QA] Backup location missing from example",
  description:
    "Synthetic QA assessment: the example recovery instruction names backup storage without a specific location.",
  severity: "high",
  severityReason:
    "The example blocker prevents finding the backup needed for recovery.",
  confidence: 0.8,
  uncertainty:
    "Synthetic QA only: the location may exist in another approved source.",
  recommendedAction:
    "Document the approved backup location and repeat the human test.",
  personId: alex.id,
  systemId: db.id,
  runId: run.id,
  evidence: [{ evidenceId: e.id, quote: e.quote }],
};
const save = (findings) =>
  action("save-risk-findings", { workspaceId, findings }, "POST");
assert.equal(
  (
    await save([
      finding,
      {
        ...finding,
        key: `qa-invalid-${crypto.randomUUID()}`,
        evidence: [
          {
            evidenceId: e.id,
            quote: "This fabricated quotation does not exist.",
          },
        ],
      },
    ])
  ).status,
  400,
);
assert.ok(
  !(await action("list-risk-findings", { workspaceId })).body.findings.some(
    (f) => f.key === finding.key,
  ),
  "Invalid batch must not partially commit",
);
assert.equal(
  (await save([{ ...finding, personId: "foreign-person" }])).status,
  400,
);
assert.equal(
  (await save([{ ...finding, processId: "foreign-process" }])).status,
  400,
);
assert.equal(
  (
    await save([
      {
        ...finding,
        evidence: [{ evidenceId: "foreign-evidence", quote: e.quote }],
      },
    ])
  ).status,
  400,
);
assert.equal(
  (await save([{ ...finding, type: "conflicting_information" }])).status,
  400,
);
const attempts = await Promise.all([1, 2].map(() => save([finding])));
for (const result of attempts)
  assert.equal(result.status, 200, JSON.stringify(result.body));
assert.deepEqual(attempts.map((r) => r.body.insertedCount).sort(), [0, 1]);
let risk = (
  await action("get-risk-finding", {
    workspaceId,
    id: attempts[0].body.findings[0].id,
  })
).body;
assert.equal(risk.status, "proposed");
assert.equal(risk.evidence[0].quote, e.quote);
assert.equal(risk.verificationSnapshot.steps[0].notes, run.steps[1].notes);
assert.equal(risk.verificationSnapshot.revision, run.revision);
const edit = {
  workspaceId,
  id: risk.id,
  revision: risk.revision,
  title: "[QA] Corrected finding title",
  description: risk.description,
  severity: risk.severity,
  severityReason: risk.severityReason,
  confidence: risk.confidence,
  uncertainty: risk.uncertainty,
  recommendedAction: risk.recommendedAction,
  status: "accepted",
  reviewNotes: "Synthetic QA review of the example source only.",
};
assert.equal(
  (await action("update-risk-finding", { ...edit, reviewNotes: "" }, "POST"))
    .status,
  400,
);
const reviews = await Promise.all(
  [1, 2].map(() => action("update-risk-finding", edit, "POST")),
);
assert.deepEqual(reviews.map((r) => r.status).sort(), [200, 409]);
const repeated = await save([finding]);
assert.equal(repeated.body.insertedCount, 0);
assert.equal(repeated.body.findings[0].title, edit.title);
assert.equal(repeated.body.findings[0].status, "accepted");
risk = (await action("get-risk-finding", { workspaceId, id: risk.id })).body;
assert.equal(risk.reviewNotes, edit.reviewNotes);
const resolved = await action(
  "update-risk-finding",
  {
    ...edit,
    revision: risk.revision,
    status: "resolved",
    reviewNotes:
      "Synthetic QA only: exercising resolution; no real fix or restore performed.",
  },
  "POST",
);
assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
const unchanged = await action("get-verification", { workspaceId, id: run.id });
assert.deepEqual(
  unchanged.body,
  run,
  "Resolving a finding must not alter readiness or test results",
);
const reopened = await action(
  "update-risk-finding",
  {
    ...edit,
    revision: resolved.body.finding.revision,
    status: "proposed",
    reviewNotes: "Synthetic QA finding reopened for review.",
  },
  "POST",
);
assert.equal(reopened.status, 200);
assert.equal(
  (await action("get-risk-finding", { workspaceId, id: risk.id }, "GET", ""))
    .status,
  401,
);
assert.equal(
  (
    await action("get-risk-finding", {
      workspaceId: "foreign-workspace",
      id: risk.id,
    })
  ).status,
  404,
);
assert.equal(
  (await action("get-risk-finding", { workspaceId, id: "missing" })).status,
  404,
);
const listing = await action("list-risk-findings", {
  workspaceId,
  personId: alex.id,
  status: "proposed",
});
assert.equal(listing.status, 200);
assert.ok(listing.body.findings.some((f) => f.id === risk.id));
assert.ok(
  !("evidence" in listing.body.findings[0]),
  "Lists should omit long source text",
);
assert.equal((await fetch(`${base}/risks`)).status, 200);
mkdirSync(".tmp", { recursive: true });
writeFileSync(
  ".tmp/risks-proof.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      findingId: risk.id,
      runId: run.id,
      checks:
        "source integrity, source/run snapshot, batch atomicity, scope, conflict evidence, concurrent writes/reviews, correction preservation, resolution and reopening, unchanged verification, route",
    },
    null,
    2,
  ),
);
console.log(
  "Risk Register smoke passed: evidence, gap snapshot, atomic writes, scope, concurrency, human corrections and unchanged test outcome.",
);
