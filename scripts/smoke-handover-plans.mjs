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

const plans = await action("list-handover-plans", { workspaceId });
assert.equal(plans.status, 200, JSON.stringify(plans.body));
const tasks = await action("list-handover-tasks", { workspaceId });
assert.equal(tasks.status, 200, JSON.stringify(tasks.body));
for (const task of tasks.body.tasks) {
  assert.ok(["suggested", "confirmed"].includes(task.assignmentStatus));
  assert.ok(["critical", "high", "medium", "low"].includes(task.priority));
  if (task.assignmentStatus === "confirmed") {
    assert.ok(task.assigneeId);
    assert.ok(task.dueDate);
  }
}
if (tasks.body.tasks.length) {
  const detail = await action("get-handover-task", {
    workspaceId,
    id: tasks.body.tasks[0].id,
  });
  assert.equal(detail.status, 200);
  assert.equal(typeof detail.body.description, "string");
}
assert.equal(
  (await action("list-handover-plans", { workspaceId }, "GET", "")).status,
  401,
);
assert.equal(
  (await action("list-handover-plans", { workspaceId: "foreign-workspace" }))
    .status,
  404,
);
assert.equal(
  (await action("get-handover-plan", { workspaceId, id: "missing" })).status,
  404,
);
assert.equal((await fetch(`${base}/handover`)).status, 200);
mkdirSync(".tmp", { recursive: true });
writeFileSync(
  ".tmp/handover-plans-http-proof.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      planCount: plans.body.plans.length,
      taskCount: tasks.body.tasks.length,
      checks:
        "read-only HTTP migration/backward compatibility, authenticated scope, route",
    },
    null,
    2,
  ),
);
console.log(
  "Handover HTTP read checks passed; existing tasks remain valid, scoped and readable.",
);
