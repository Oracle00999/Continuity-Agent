import { demoDocuments } from "../server/domain/demo-documents.ts";
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
const source = docs.body.documents.find(
  (d) => d.source === "demo" && d.filename === "Database Backup & Restore.md",
);
assert.ok(source);
const saved = await action("get-document", { workspaceId, id: source.id });
assert.equal(saved.status, 200);
const fixture = demoDocuments.find((d) => d.filename === source.filename);
assert.ok(fixture);
assert.equal(saved.body.source, "demo");
assert.equal(
  saved.body.extractedText,
  fixture.text,
  "Only the unchanged developer-authored fictional fixture can be sent to the model",
);
assert.deepEqual(
  workspace.body.people.map((p) => p.name).sort(),
  [
    "Alex Morgan",
    "Maya Chen",
    "Daniel Reed",
    "Priya Shah",
    "Jordan Lee",
  ].sort(),
);

const risks = await action("list-risk-findings", { workspaceId });
assert.equal(risks.status, 200);
let selectedRisk = null;
for (const candidate of risks.body.findings.filter(
  (f) => f.status === "proposed" && !f.title.startsWith("[QA]"),
)) {
  const detail = await action("get-risk-finding", {
    workspaceId,
    id: candidate.id,
  });
  if (
    detail.status === 200 &&
    detail.body.reviewedBy === null &&
    detail.body.reviewNotes === "" &&
    detail.body.evidence.every((e) => e.documentId === source.id)
  ) {
    selectedRisk = detail.body;
    break;
  }
}
assert.ok(
  selectedRisk,
  "A never-reviewed proposal backed only by the unchanged fictional fixture is required",
);
for (const citation of selectedRisk.evidence)
  assert.ok(
    saved.body.evidence
      .find((e) => e.id === citation.evidenceId)
      ?.quote.includes(citation.quote),
  );
const alex = workspace.body.people.find((p) => p.name === "Alex Morgan");
assert.ok(alex.departureDate);
const existingPlans = await action("list-handover-plans", { workspaceId });
assert.equal(existingPlans.status, 200);
for (const old of existingPlans.body.plans.filter(
  (p) => p.personId === alex.id,
)) {
  const detail = await action("get-handover-plan", { workspaceId, id: old.id });
  assert.equal(
    detail.body.status,
    "draft",
    "Do not run this test against a human-approved plan",
  );
  assert.ok(
    detail.body.tasks.every(
      (t) =>
        t.findingId === selectedRisk.id &&
        t.assignmentStatus === "suggested" &&
        t.revision === 0,
    ),
    "Do not export or modify human-edited draft tasks",
  );
}
const response = await fetch(`${base}/_agent-native/agent-chat`, {
  method: "POST",
  headers: {
    cookie,
    origin: base,
    "content-type": "application/json",
    "X-Agent-Native-Browser-Tab": "continuity-plan-integration-test",
  },
  signal: AbortSignal.timeout(180000),
  body: JSON.stringify({
    message: `Draft a departure handover plan for fictional Alex Morgan (${alex.id}) in workspace ${workspaceId}, using ONLY selected saved risk ${selectedRisk.id} from the unchanged developer-authored fictional restore runbook. Read that finding and team context, then save one practical proposed task with description and priority. Suggest an appropriate workspace owner and date before Alex's saved departure if justified; leave either null if uncertain. Treat them as suggestions only. Do not approve, reopen, remove or complete anything, change findings, read unrelated documents, send messages, or execute infrastructure. Preserve existing draft edits and read back the plan. Reply briefly with a named plan link and explain that approval is still needed.`,
    engine: "ai-sdk:openai",
    model: "gpt-5-mini",
    mode: "act",
    history: [],
    browserTabId: "continuity-plan-integration-test",
  }),
});
assert.equal(response.status, 200);
assert.ok(response.body);
const reader = response.body.getReader();
const decoder = new TextDecoder();
let pending = "";
let finished = false;
const events = [];
while (!finished) {
  const { done, value } = await reader.read();
  if (done) break;
  pending += decoder.decode(value, { stream: true });
  let boundary;
  while ((boundary = pending.indexOf("\n")) >= 0) {
    const line = pending.slice(0, boundary).trim();
    pending = pending.slice(boundary + 1);
    if (!line.startsWith("data:")) continue;
    let event;
    try {
      event = JSON.parse(line.slice(5).trim());
    } catch {
      continue;
    }
    events.push(event);
    if (event.type === "done" || event.type === "error") finished = true;
  }
}
await reader.cancel();
mkdirSync(".tmp", { recursive: true });
writeFileSync(".tmp/plan-analyst-events.json", JSON.stringify(events, null, 2));
assert.equal(events.filter((e) => e.type === "error").length, 0);

const tools = events.filter((e) => e.type === "tool_done" && !e.isError);
assert.ok(
  !tools.some((e) =>
    [
      "review-handover-plan",
      "remove-handover-plan-task",
      "update-handover-task",
      "update-risk-finding",
    ].includes(e.tool),
  ),
  "Draft generation must not invent human review or progress",
);
const listed = await action("list-handover-plans", { workspaceId });
assert.equal(listed.status, 200);
const savedPlan = listed.body.plans.find((p) => p.personId === alex.id);
assert.ok(savedPlan);
const detail = await action("get-handover-plan", {
  workspaceId,
  id: savedPlan.id,
});
assert.equal(detail.status, 200);
assert.equal(detail.body.status, "draft");
const proposed = detail.body.tasks.find((t) => t.findingId === selectedRisk.id);
assert.ok(proposed);
assert.equal(proposed.assignmentStatus, "suggested");
assert.equal(proposed.status, "todo");
const task = await action("get-handover-task", {
  workspaceId,
  id: proposed.id,
});
assert.equal(task.status, 200);
assert.ok(task.body.description.length >= 10);
assert.equal(task.body.documentId, source.id);
assert.ok(task.body.findingUrlPath.includes(selectedRisk.id));
const unchanged = await action("get-risk-finding", {
  workspaceId,
  id: selectedRisk.id,
});
assert.deepEqual(unchanged.body, selectedRisk);
let text = "";
for (const e of events) {
  if (e.type === "clear") text = "";
  if (e.type === "text") text += e.text ?? "";
}
assert.ok(
  !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
    text.replace(/\[[^\]]+\]\([^)]+\)/g, "source link"),
  ),
);
writeFileSync(
  ".tmp/plan-analyst-proof.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      planId: savedPlan.id,
      taskId: proposed.id,
      text,
      tools: tools.map((e) => e.tool),
      checks:
        "draft task persists, remains suggested/todo, source risk unchanged, no self-approval, readable links",
    },
    null,
    2,
  ),
);
console.log(
  "Live plan generation passed: a real source-linked draft task persisted; no self-approval, commitments or readiness changes.",
);
