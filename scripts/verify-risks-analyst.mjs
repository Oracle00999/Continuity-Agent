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
const response = await fetch(`${base}/_agent-native/agent-chat`, {
  method: "POST",
  headers: {
    cookie,
    origin: base,
    "content-type": "application/json",
    "X-Agent-Native-Browser-Tab": "continuity-risk-integration-test",
  },
  signal: AbortSignal.timeout(180000),
  body: JSON.stringify({
    message: `Assess only the documentation in unchanged fictional runbook ${source.id} in workspace ${workspaceId}. Focus on whether the backup retrieval instructions specify a backup location. Read existing risk findings to avoid duplicates, read the source, and save a supported documentation-gap finding as a proposal, with exact quotes, a clear severity reason, remaining uncertainty and a practical next action. Relate it to Alex Morgan if supported. Do not confirm or resolve findings. Do not read other documents, execute operations, or use any synthetic QA test record as real execution evidence. Describe this as a gap in the reviewed runbook, not proof that the location is unknown everywhere. Read back the saved finding and report briefly what changed.`,
    engine: "ai-sdk:openai",
    model: "gpt-5-mini",
    mode: "act",
    history: [],
    browserTabId: "continuity-risk-integration-test",
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
writeFileSync(".tmp/risk-analyst-events.json", JSON.stringify(events, null, 2));
assert.equal(events.filter((e) => e.type === "error").length, 0);
const tools = events.filter((e) => e.type === "tool_done" && !e.isError);
assert.ok(tools.some((e) => e.tool === "get-document"));
assert.ok(tools.some((e) => e.tool === "list-risk-findings"));
assert.ok(
  !tools.some((e) => e.tool === "update-risk-finding"),
  "The agent must not self-accept its assessment",
);
const listing = await action("list-risk-findings", { workspaceId });
assert.equal(listing.status, 200);
const details = await Promise.all(
  listing.body.findings
    .filter((f) => !f.title.startsWith("[QA]"))
    .map((f) => action("get-risk-finding", { workspaceId, id: f.id })),
);
const matched = details
  .map((r) => r.body)
  .filter((f) => f.evidence?.some((e) => e.documentId === source.id));
assert.ok(matched.length > 0, "A source-linked finding must actually persist");
for (const finding of matched) {
  assert.equal(finding.status, "proposed");
  assert.ok(finding.uncertainty.length >= 10);
  assert.ok(finding.severityReason.length >= 10);
  for (const citation of finding.evidence) {
    const passage = saved.body.evidence.find(
      (e) => e.id === citation.evidenceId,
    );
    assert.ok(passage?.quote.includes(citation.quote));
  }
}
// The response guard can replace a streamed draft. Inspect the final reply,
// matching the client's clear-event handling rather than concatenating drafts.
let text = "";
for (const event of events) {
  if (event.type === "clear") text = "";
  if (event.type === "text") text += event.text ?? "";
}
const visible = text.replace(/\[[^\]]+\]\([^)]+\)/g, "source link");
assert.ok(
  !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
    visible,
  ),
  "Internal IDs must stay inside named link targets",
);
writeFileSync(
  ".tmp/risk-analyst-proof.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      findingCount: matched.length,
      text,
      tools: tools.map((e) => e.tool),
    },
    null,
    2,
  ),
);
console.log(
  `Live risk assessment passed: ${matched.length} source-linked proposed finding(s) persisted with uncertainty; no self-acceptance or fabricated execution.`,
);
