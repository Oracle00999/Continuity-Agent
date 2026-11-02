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

const before = await action("list-verifications", { workspaceId });
const response = await action("get-overview", { workspaceId });
assert.equal(response.status, 200, JSON.stringify(response.body));
const data = response.body;
assert.equal(data.workspace.id, workspaceId);
assert.ok(data.calendarDay.match(/^\d{4}-\d{2}-\d{2}$/));
assert.equal(
  data.metrics.criticalSystems,
  workspace.body.systems.filter((s) => s.criticality === "critical").length,
);
for (const value of Object.values(data.metrics))
  assert.ok(Number.isInteger(value) && value >= 0);
assert.ok(
  data.topRisks.length <= 5 &&
    data.upcomingTasks.length <= 5 &&
    data.latestTests.length <= 6 &&
    data.activity.length <= 10,
);
assert.ok(
  data.topRisks.every((r) => ["proposed", "accepted"].includes(r.status)),
);
assert.ok(
  data.upcomingTasks.every(
    (t) => t.assignmentStatus === "confirmed" && t.status !== "done",
  ),
);
assert.equal(
  new Set(data.latestTests.map((r) => r.documentId)).size,
  data.latestTests.length,
);
assert.deepEqual(
  (await action("list-verifications", { workspaceId })).body,
  before.body,
);
assert.equal(
  (await action("get-overview", { workspaceId }, "GET", "")).status,
  401,
);
assert.equal(
  (await action("get-overview", { workspaceId: "foreign-workspace" })).status,
  404,
);
assert.equal((await fetch(`${base}/overview`)).status, 200);
const landing = await fetch(`${base}/`, {
  headers: { cookie },
  redirect: "manual",
});
assert.ok([200, 302, 303, 307].includes(landing.status));
if (landing.status !== 200)
  assert.match(landing.headers.get("location"), /\/overview(?:[?#]|$)/);
mkdirSync(".tmp", { recursive: true });
writeFileSync(
  ".tmp/overview-proof.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      metrics: data.metrics,
      checks:
        "live SQL, scoped auth, bounded lists, latest per runbook, no verification writes, overview route and authenticated landing",
    },
    null,
    2,
  ),
);
console.log(
  "Overview HTTP smoke passed: live metrics, bounded queues, source scopes, latest test rows, unchanged outcomes and landing route.",
);
