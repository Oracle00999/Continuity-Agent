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

const fixture = `# Knowledge extraction QA

Alex Morgan owns the PostgreSQL database and maintains the recovery checklist.

Maya Chen supports the Production API.

Synthetic QA only: no infrastructure operation was performed.
`;
const form = new FormData();
form.set("workspaceId", workspaceId);
form.set("file", new File([fixture], "Knowledge extraction QA.md"));
const staged = await fetch(`${base}/api/document-upload`, {
  method: "POST",
  headers: { cookie, origin: base },
  body: form,
});
assert.equal(staged.status, 201);
const uploaded = await action(
  "ingest-document",
  { workspaceId, attachmentRef: (await staged.json()).attachmentRef },
  "POST",
);
assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
const doc = uploaded.body.document;
const alex = workspace.body.people.find((p) => p.name === "Alex Morgan");
const maya = workspace.body.people.find((p) => p.name === "Maya Chen");
const postgres = workspace.body.systems.find(
  (s) => s.name === "PostgreSQL database",
);
const passage = doc.evidence.find((e) => e.quote.includes("Alex Morgan owns"));
assert.ok(passage);
const valid = {
  personId: alex.id,
  relationship: "owns",
  target: { kind: "system", id: postgres.id },
  evidenceId: passage.id,
  quote: passage.quote,
  confidence: 0.95,
};
const processClaim = {
  ...valid,
  relationship: "maintains",
  target: { kind: "process", name: "recovery checklist" },
};
const save = (claims) =>
  action(
    "save-knowledge-extraction",
    { workspaceId, documentId: doc.id, claims },
    "POST",
  );
const before = await action("list-knowledge", {
  workspaceId,
  documentId: doc.id,
});
assert.equal(before.status, 200);
const beforeCount = before.body.claims.length;
assert.equal(
  (
    await save([
      valid,
      { ...processClaim, quote: "Fabricated unsupported quotation." },
    ])
  ).status,
  400,
);
assert.equal(
  (await action("list-knowledge", { workspaceId, documentId: doc.id })).body
    .claims.length,
  beforeCount,
  "Invalid batch leaves no partial claims",
);
assert.equal(
  (await save([{ ...valid, personId: maya.id }])).status,
  400,
  "Person must be explicitly named",
);
assert.equal(
  (
    await save([
      {
        ...processClaim,
        target: { kind: "process", name: "Invented procedure" },
      },
    ])
  ).status,
  400,
);
assert.equal(
  (await save([{ ...valid, evidenceId: "foreign-evidence" }])).status,
  400,
);
assert.equal(
  (await save([{ ...valid, target: { kind: "system", id: "foreign-system" } }]))
    .status,
  400,
);
assert.equal((await save([valid, valid])).status, 400);
const results = await Promise.all(
  [1, 2].map(() => save([valid, processClaim])),
);
for (const result of results)
  assert.equal(result.status, 200, JSON.stringify(result.body));
const listed = await action("list-knowledge", {
  workspaceId,
  documentId: doc.id,
});
assert.equal(listed.body.claims.length, 2);
let claim = listed.body.claims.find((c) => c.targetKind === "process");
assert.ok(claim.targetId);
assert.equal(claim.quote, passage.quote);
assert.equal(claim.evidenceId, passage.id);
const sameProcess = await save([
  {
    ...processClaim,
    target: { kind: "process", name: "RECOVERY   CHECKLIST" },
  },
]);
assert.equal(sameProcess.status, 200);
assert.equal(sameProcess.body.insertedCount, 0);
assert.equal(sameProcess.body.claims[0].targetId, claim.targetId);
const edits = await Promise.all(
  [1, 2].map(() =>
    action(
      "review-knowledge",
      {
        workspaceId,
        id: claim.id,
        revision: claim.revision,
        status: "rejected",
        notes: "Synthetic QA review: exercising correction persistence only.",
      },
      "POST",
    ),
  ),
);
assert.deepEqual(edits.map((r) => r.status).sort(), [200, 409]);
const repeat = await save([valid, processClaim]);
assert.equal(repeat.body.insertedCount, 0);
claim = repeat.body.claims.find((c) => c.targetKind === "process");
assert.equal(claim.status, "rejected");
assert.equal(
  claim.revision,
  edits.find((r) => r.status === 200).body.claim.revision,
);
assert.match(claim.reviewNotes, /Synthetic QA/);
assert.equal(
  (
    await action(
      "review-knowledge",
      {
        workspaceId,
        id: claim.id,
        revision: 1,
        status: "confirmed",
        notes: "",
      },
      "POST",
    )
  ).status,
  400,
);
assert.equal(
  (
    await action(
      "list-knowledge",
      { workspaceId, documentId: doc.id },
      "GET",
      "",
    )
  ).status,
  401,
);
assert.equal(
  (
    await action("list-knowledge", {
      workspaceId: "foreign-workspace",
      documentId: doc.id,
    })
  ).status,
  404,
);
assert.equal(
  (
    await action(
      "review-knowledge",
      {
        workspaceId,
        id: "missing",
        revision: 0,
        status: "confirmed",
        notes: "QA",
      },
      "POST",
    )
  ).status,
  404,
);
assert.equal(
  (
    await action("list-knowledge", { workspaceId, personId: alex.id })
  ).body.claims.filter((c) => c.documentId === doc.id).length,
  2,
);
mkdirSync(".tmp", { recursive: true });
writeFileSync(
  ".tmp/knowledge-proof.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      documentId: doc.id,
      claimIds: listed.body.claims.map((c) => c.id),
      checks:
        "exact quotes, endpoint validation, atomic rejection, concurrent deduplication, process normalization, explicit review, concurrent review rejection, corrections preserved on re-extraction, scope",
    },
    null,
    2,
  ),
);
console.log(
  "Knowledge smoke passed: exact evidence, entity matching, atomic batch, process reuse, concurrent writes, human corrections and scope.",
);
