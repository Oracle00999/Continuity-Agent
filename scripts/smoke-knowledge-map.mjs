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

const list = await action("list-knowledge", { workspaceId });
assert.equal(list.status, 200);
assert.ok(list.body.claims.length, "Extract document knowledge first");
const before = await action("list-verifications", { workspaceId });
const graph = await action("get-knowledge-map", {
  workspaceId,
  confirmedOnly: false,
});
assert.equal(graph.status, 200, JSON.stringify(graph.body));
const data = graph.body;
assert.ok(data.claimCount > 0);
assert.ok(data.claimCount <= 150);
assert.equal(data.edges.length, data.claimCount * 2);
const nodeIds = new Set(data.nodes.map((n) => n.id));
assert.equal(nodeIds.size, data.nodes.length);
for (const edge of data.edges) {
  assert.ok(nodeIds.has(edge.source));
  assert.ok(nodeIds.has(edge.target));
  assert.ok(["inferred", "confirmed"].includes(edge.status));
}
for (const claim of list.body.claims.filter((c) => c.status === "rejected"))
  assert.ok(!data.edges.some((e) => e.claimId === claim.id));
const claim = list.body.claims.find((c) => c.status !== "rejected");
assert.ok(claim);
const focused = await action("get-knowledge-map", {
  workspaceId,
  personId: claim.personId,
  confirmedOnly: false,
});
assert.equal(focused.status, 200, JSON.stringify(focused.body));
assert.equal(focused.body.selectedNode.id, `person:${claim.personId}`);
assert.ok(
  focused.body.selectedClaims.every((c) => c.personId === claim.personId),
);
const selected = await action("get-knowledge-map", {
  workspaceId,
  personId: claim.personId,
  nodeId: `${claim.targetKind}:${claim.targetId}`,
  confirmedOnly: false,
});
assert.equal(selected.status, 200, JSON.stringify(selected.body));
assert.equal(selected.body.selectedNode.name, claim.targetName);
assert.ok(selected.body.selectedClaims.some((c) => c.id === claim.id));
const doc = await action("get-document", { workspaceId, id: claim.documentId });
assert.equal(doc.status, 200);
assert.ok(
  doc.body.evidence
    .find((e) => e.id === claim.evidenceId)
    .quote.includes(
      selected.body.selectedClaims.find((c) => c.id === claim.id).quote,
    ),
);
const source = await action("get-knowledge-map", {
  workspaceId,
  nodeId: `document:${claim.documentId}`,
  confirmedOnly: false,
});
assert.equal(source.status, 200);
assert.ok(
  source.body.selectedClaims.every((c) => c.documentId === claim.documentId),
);
const confirmed = await action("get-knowledge-map", {
  workspaceId,
  confirmedOnly: true,
});
assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
assert.ok(confirmed.body.edges.every((e) => e.status === "confirmed"));
assert.equal(
  (
    await action("get-knowledge-map", {
      workspaceId,
      personId: "foreign-person",
    })
  ).status,
  404,
);
assert.equal(
  (
    await action("get-knowledge-map", {
      workspaceId,
      nodeId: "system:foreign-system",
    })
  ).status,
  404,
);
assert.equal(
  (await action("get-knowledge-map", { workspaceId: "foreign-workspace" }))
    .status,
  404,
);
assert.equal(
  (await action("get-knowledge-map", { workspaceId }, "GET", "")).status,
  401,
);
assert.deepEqual(
  (await action("list-verifications", { workspaceId })).body,
  before.body,
);
assert.equal((await fetch(`${base}/knowledge-map`)).status, 200);
mkdirSync(".tmp", { recursive: true });
writeFileSync(
  ".tmp/knowledge-map-proof.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      claimCount: data.claimCount,
      nodeCount: data.nodes.length,
      edgeCount: data.edges.length,
      checks:
        "source integrity, endpoints, filters, rejected exclusion, selection, scope, unchanged tests, route",
    },
    null,
    2,
  ),
);
console.log(
  `Knowledge map smoke passed: ${data.nodes.length} nodes and ${data.edges.length} source-backed edges; filters, selection, scope and unchanged readiness verified.`,
);
