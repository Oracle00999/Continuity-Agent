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

const docs = await action("list-documents", { workspaceId });
const doc = docs.body.documents.find(
  (d) => d.source === "demo" && d.filename === "Database Backup & Restore.md",
);
assert.ok(doc);
const tester = workspace.body.people.find((p) => p.name === "Maya Chen");
const input = {
  workspaceId,
  documentId: doc.id,
  testerId: tester.id,
  requestId: crypto.randomUUID(),
};
const started = await action("start-procedure-verification", input, "POST");
assert.equal(started.status, 200, JSON.stringify(started.body));
let run = started.body.run;
assert.equal(run.steps.length, 6);
assert.equal(run.status, "open");
assert.ok(run.steps.every((s) => s.result === "pending"));
const again = await action("start-procedure-verification", input, "POST");
assert.equal(again.body.run.id, run.id);
const missing = await action("get-verification", {
  workspaceId,
  id: "does-not-exist",
});
assert.equal(missing.status, 404);
assert.equal(
  (await action("get-verification", { workspaceId, id: run.id }, "GET", ""))
    .status,
  401,
);
assert.equal(
  (
    await action("get-verification", {
      workspaceId: "foreign-workspace",
      id: run.id,
    })
  ).status,
  404,
);
const finalize = (
  outcome,
  summary = "Synthetic QA only: no infrastructure test was performed.",
) =>
  action(
    "finalize-verification",
    { workspaceId, id: run.id, revision: run.revision, outcome, summary },
    "POST",
  );
assert.equal(
  (await finalize("passed")).status,
  400,
  "Pending steps prevent finalization",
);
const results = run.steps.map((s) => ({
  number: s.number,
  result: s.number === 2 ? "blocked" : "completed",
  notes: "Synthetic QA result; no real test performed.",
}));
const recorded = await action(
  "record-verification-steps",
  { workspaceId, id: run.id, revision: run.revision, results },
  "POST",
);
assert.equal(recorded.status, 200, JSON.stringify(recorded.body));
run = recorded.body.run;
assert.equal(run.revision, 1);
assert.equal((await finalize("passed")).status, 400);
assert.equal((await finalize("passed_with_gaps")).status, 400);
assert.equal(
  (
    await action(
      "record-verification-steps",
      { workspaceId, id: run.id, revision: 0, results },
      "POST",
    )
  ).status,
  409,
);
const failed = await finalize("failed");
assert.equal(failed.status, 200, JSON.stringify(failed.body));
assert.equal(failed.body.run.status, "failed");
assert.equal(
  (
    await action(
      "record-verification-steps",
      { workspaceId, id: run.id, revision: 2, results },
      "POST",
    )
  ).status,
  409,
);
const persisted = await action("get-verification", { workspaceId, id: run.id });
assert.equal(persisted.body.status, "failed");
assert.equal(persisted.body.steps[1].result, "blocked");
// A separate synthetic run exercises concurrent revision protection and a human-reported pass.
const second = await action(
  "start-procedure-verification",
  { ...input, requestId: crypto.randomUUID() },
  "POST",
);
const secondRun = second.body.run;
const passResults = secondRun.steps.map((s) => ({
  number: s.number,
  result: "completed",
  notes: "Synthetic QA only, no actual execution.",
}));
const concurrent = await Promise.all(
  [1, 2].map(() =>
    action(
      "record-verification-steps",
      { workspaceId, id: secondRun.id, revision: 0, results: passResults },
      "POST",
    ),
  ),
);
assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
const passed = await action(
  "finalize-verification",
  {
    workspaceId,
    id: secondRun.id,
    revision: 1,
    outcome: "passed",
    summary: "Synthetic QA only. This is not a real restoration test.",
  },
  "POST",
);
assert.equal(passed.status, 200, JSON.stringify(passed.body));
assert.equal(passed.body.run.status, "passed");
assert.equal(
  (await action("list-verifications", { workspaceId })).body.runs.some(
    (r) => r.id === run.id,
  ),
  true,
);
const page = await fetch(`${base}/verification`);
assert.equal(page.status, 200);
mkdirSync(".tmp", { recursive: true });
writeFileSync(
  ".tmp/verification-proof.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      blockedRunId: run.id,
      syntheticPassRunId: secondRun.id,
      checks:
        "6 exact steps, duplicate start, authorization, incomplete/blocked rejection, stale revision, concurrent writer rejection, finalization, persisted reread, route",
    },
    null,
    2,
  ),
);
console.log(
  "Verification smoke passed: source steps, persistence, scope, blocking rules, immutable outcomes, concurrent edits, route.",
);
