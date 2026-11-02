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
const maya = workspace.body.people.find((p) => p.name === "Maya Chen");
const alex = workspace.body.people.find((p) => p.name === "Alex Morgan");
const createdRun = await action(
  "start-procedure-verification",
  {
    workspaceId,
    documentId: doc.id,
    testerId: maya.id,
    requestId: crypto.randomUUID(),
  },
  "POST",
);
assert.equal(createdRun.status, 200, JSON.stringify(createdRun.body));
let run = createdRun.body.run;
const report = await action(
  "record-verification-steps",
  {
    workspaceId,
    id: run.id,
    revision: run.revision,
    results: [
      {
        number: 2,
        result: "blocked",
        notes: "Synthetic QA only: backup location missing.",
      },
      {
        number: 3,
        result: "unclear",
        notes: "Synthetic QA only: checksum instructions unclear.",
      },
    ],
  },
  "POST",
);
assert.equal(report.status, 200, JSON.stringify(report.body));
run = report.body.run;
const input = {
  workspaceId,
  runId: run.id,
  sourceRevision: run.revision,
  tasks: [
    {
      stepNumber: 2,
      title: "[QA] Document backup location",
      assigneeId: alex.id,
      dueDate: "2026-11-02",
    },
    {
      stepNumber: 3,
      title: "[QA] Clarify checksum verification",
      assigneeId: alex.id,
      dueDate: "2026-11-03",
    },
  ],
};
const before = await action("list-handover-tasks", {
  workspaceId,
  runId: run.id,
});
assert.equal(before.status, 200, JSON.stringify(before.body));
assert.equal(before.body.tasks.length, 0);
const badBatch = await action(
  "create-handover-tasks",
  { ...input, tasks: [input.tasks[0], { ...input.tasks[1], stepNumber: 99 }] },
  "POST",
);
assert.equal(badBatch.status, 400);
assert.equal(
  (await action("list-handover-tasks", { workspaceId, runId: run.id })).body
    .tasks.length,
  0,
  "Invalid batches are atomic",
);
assert.equal(
  (
    await action(
      "create-handover-tasks",
      { ...input, sourceRevision: 0 },
      "POST",
    )
  ).status,
  409,
);
assert.equal(
  (
    await action(
      "create-handover-tasks",
      {
        ...input,
        tasks: [{ ...input.tasks[0], assigneeId: "foreign-person" }],
      },
      "POST",
    )
  ).status,
  404,
);
assert.equal(
  (
    await action(
      "create-handover-tasks",
      { ...input, tasks: [{ ...input.tasks[0], dueDate: "2026-02-30" }] },
      "POST",
    )
  ).status,
  400,
);
const concurrent = await Promise.all(
  [1, 2].map(() => action("create-handover-tasks", input, "POST")),
);
for (const result of concurrent)
  assert.equal(result.status, 200, JSON.stringify(result.body));
assert.deepEqual(concurrent.map((r) => r.body.insertedCount).sort(), [0, 2]);
let task = concurrent[0].body.tasks.find((t) => t.stepNumber === 2);
assert.equal(task.assigneeName, "Alex Morgan");
assert.equal(task.status, "todo");
assert.equal(task.gapNotes, run.steps[1].notes);
assert.equal(task.instruction, run.steps[1].instruction);
assert.equal(task.documentId, doc.id);
const repeated = await action(
  "create-handover-tasks",
  {
    ...input,
    tasks: input.tasks.map((t) => ({
      ...t,
      title: "Do not overwrite existing tasks",
    })),
  },
  "POST",
);
assert.equal(repeated.body.insertedCount, 0);
assert.ok(repeated.body.tasks.every((t) => t.title.startsWith("[QA]")));
assert.equal(
  (await action("get-handover-task", { workspaceId, id: task.id }, "GET", ""))
    .status,
  401,
);
assert.equal(
  (
    await action("get-handover-task", {
      workspaceId: "foreign-workspace",
      id: task.id,
    })
  ).status,
  404,
);
assert.equal(
  (await action("get-handover-task", { workspaceId, id: "missing" })).status,
  404,
);
const update = {
  workspaceId,
  id: task.id,
  revision: task.revision,
  title: task.title,
  assigneeId: task.assigneeId,
  dueDate: task.dueDate,
  status: "done",
  resolution: "",
};
assert.equal(
  (await action("update-handover-task", update, "POST")).status,
  400,
  "Resolution is required",
);
const edits = await Promise.all(
  [1, 2].map(() =>
    action(
      "update-handover-task",
      {
        ...update,
        status: "in_progress",
        resolution: "Synthetic QA progress only.",
      },
      "POST",
    ),
  ),
);
assert.deepEqual(edits.map((r) => r.status).sort(), [200, 409]);
task = (await action("get-handover-task", { workspaceId, id: task.id })).body;
const done = await action(
  "update-handover-task",
  {
    ...update,
    revision: task.revision,
    resolution:
      "Synthetic QA only: sample documentation corrected; no restore performed.",
  },
  "POST",
);
assert.equal(done.status, 200, JSON.stringify(done.body));
assert.equal(done.body.task.status, "done");
const unchangedRun = await action("get-verification", {
  workspaceId,
  id: run.id,
});
assert.equal(unchangedRun.body.status, "open");
assert.equal(unchangedRun.body.steps[1].result, "blocked");
assert.equal(unchangedRun.body.revision, run.revision);
const reopened = await action(
  "update-handover-task",
  {
    ...update,
    revision: done.body.task.revision,
    status: "todo",
    resolution: done.body.task.resolution,
  },
  "POST",
);
assert.equal(reopened.status, 200, JSON.stringify(reopened.body));
assert.equal(reopened.body.task.status, "todo");
const listed = await action("list-handover-tasks", {
  workspaceId,
  runId: run.id,
});
assert.equal(listed.body.tasks.length, 2);
assert.ok(!("gapNotes" in listed.body.tasks[0]), "List omits long notes");
assert.equal((await fetch(`${base}/tasks`)).status, 200);
mkdirSync(".tmp", { recursive: true });
writeFileSync(
  ".tmp/handover-tasks-proof.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      runId: run.id,
      taskIds: listed.body.tasks.map((t) => t.id),
      checks:
        "atomic batch, exact provenance, duplicate/concurrent creates, tenant scope, invalid deadline/owner, stale and concurrent updates, required resolution, reopen, verification unchanged, route",
    },
    null,
    2,
  ),
);
console.log(
  "Handover tasks smoke passed: 2 linked tasks, atomic writes, provenance, scope, concurrency, resolution and reopen; original test unchanged.",
);
