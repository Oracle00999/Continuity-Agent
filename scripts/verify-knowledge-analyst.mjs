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
    "X-Agent-Native-Browser-Tab": "continuity-knowledge-integration-test",
  },
  signal: AbortSignal.timeout(180000),
  body: JSON.stringify({
    message: `Extract and save the engineering responsibilities explicitly documented in saved document ${source.id} in workspace ${workspaceId}. Read that source, match existing people and systems, include specifically named processes only where explicitly supported, and save the supported relationships in one batch. Keep all new claims needing human review and preserve any existing reviews. Do not review or confirm claims. Use only this selected fictional source; do not read other documents. Read back the saved knowledge and report briefly what changed.`,
    engine: "ai-sdk:openai",
    model: "gpt-5-mini",
    mode: "act",
    history: [],
    browserTabId: "continuity-knowledge-integration-test",
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
writeFileSync(
  ".tmp/knowledge-analyst-events.json",
  JSON.stringify(events, null, 2),
);
assert.equal(events.filter((e) => e.type === "error").length, 0);
const tools = events.filter((e) => e.type === "tool_done" && !e.isError);
assert.ok(tools.some((e) => e.tool === "get-document"));
assert.ok(tools.some((e) => e.tool === "save-knowledge-extraction"));
assert.ok(tools.some((e) => e.tool === "list-knowledge"));
assert.ok(!tools.some((e) => e.tool === "review-knowledge"));
const result = await action("list-knowledge", {
  workspaceId,
  documentId: source.id,
});
assert.equal(result.status, 200);
assert.ok(result.body.claims.length > 0);
assert.ok(
  result.body.claims.some((c) => c.targetKind === "process"),
  "Named procedure responsibilities must be extracted, not only system mentions",
);
const alex = workspace.body.people.find((p) => p.name === "Alex Morgan");
for (const claim of result.body.claims) {
  assert.equal(claim.status, "inferred");
  assert.equal(
    claim.personId,
    alex.id,
    "Reading a runbook must not be converted into Maya owning its operations",
  );
  const passage = saved.body.evidence.find((e) => e.id === claim.evidenceId);
  assert.ok(passage?.quote.includes(claim.quote));
  assert.ok(claim.confidence >= 0 && claim.confidence <= 1);
}
const text = events
  .filter((e) => e.type === "text")
  .map((e) => e.text ?? "")
  .join("");
writeFileSync(
  ".tmp/knowledge-analyst-proof.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      claimCount: result.body.claims.length,
      text,
      tools: tools.map((e) => e.tool),
    },
    null,
    2,
  ),
);
console.log(
  `Live Analyst extraction passed: ${result.body.claims.length} source-backed claims persisted for review; no self-confirmation or inferred Maya ownership.`,
);
