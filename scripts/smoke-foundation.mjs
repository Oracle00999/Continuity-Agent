import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

// Integration test against the running local app. Uses the starter's own local
// sign-in and real HTTP/CLI action transports; never logs session credentials.
const base = process.argv[2] ?? "http://localhost:8080";
const signIn = await fetch(`${base}/_agent-native/auth/local-dev`, {
  method: "POST",
});
assert.equal(signIn.status, 200, "Local development sign-in must be available");
const cookie = signIn.headers
  .getSetCookie()
  .map((value) => value.split(";")[0])
  .join("; ");
assert.ok(cookie, "Local sign-in must issue a test session");
const membershipResponse = await fetch(`${base}/_agent-native/org/me`, {
  headers: { cookie },
});
assert.equal(membershipResponse.status, 200);
const membership = await membershipResponse.json();
const callerEnv = {
  AGENT_USER_EMAIL: membership.email,
  AGENT_ORG_ID: membership.orgId ?? "",
};

async function read(input = {}, session = cookie) {
  const url = new URL("/_agent-native/actions/get-workspace-context", base);
  for (const [key, value] of Object.entries(input))
    url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: session ? { cookie: session } : {},
  });
  return { status: response.status, body: await response.json() };
}

function cli(action, input = {}, env = {}) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "actions/run.ts", action, JSON.stringify(input)],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, ...callerEnv, ...env },
    },
  );
  if (result.error) throw result.error;
  return { status: result.status, text: result.stdout + result.stderr };
}

const initialized = cli("initialize-demo-workspace");
assert.equal(initialized.status, 0, "CLI demo setup must succeed");
const first = await read();
assert.equal(first.status, 200);
assert.equal(first.body.workspace.name, "Northstar Digital");
assert.equal(first.body.people.length, 5);
assert.equal(first.body.systems.length, 6);
const workspaceId = first.body.workspace.id;
const alex = first.body.people.find((person) => person.name === "Alex Morgan");
assert.ok(alex?.departureDate);
assert.ok(
  !("ownerEmail" in first.body.workspace),
  "Caller identities must not leak into workspace output",
);
if (existsSync(".tmp/foundation-context.json")) {
  const previous = JSON.parse(
    readFileSync(".tmp/foundation-context.json", "utf8"),
  );
  if (
    previous.ownerEmail === membership.email &&
    previous.orgId === membership.orgId
  ) {
    assert.deepEqual(
      first.body,
      previous.snapshot,
      "Workspace records must survive a server restart unchanged",
    );
  }
}

const repeat = cli("initialize-demo-workspace");
assert.equal(repeat.status, 0);
assert.deepEqual(
  (await read()).body,
  first.body,
  "Repeated seeding must preserve IDs, counts, and departure date",
);

const selected = await read({ workspaceId, selectedPersonId: alex.id });
assert.equal(selected.status, 200);
assert.deepEqual(selected.body.selectedPerson, alex);
const agentRead = cli("get-workspace-context", {
  workspaceId,
  selectedPersonId: alex.id,
});
assert.equal(agentRead.status, 0);
assert.ok(
  agentRead.text.includes(workspaceId) && agentRead.text.includes(alex.id),
  "CLI and HTTP must return the same saved identifiers",
);

const missingPerson = await read({
  workspaceId,
  selectedPersonId: "not-in-this-workspace",
});
assert.equal(missingPerson.status, 404);
const unauthenticated = await read({}, "");
assert.equal(unauthenticated.status, 401);

const otherOwner = cli(
  "get-workspace-context",
  { workspaceId },
  { AGENT_USER_EMAIL: "isolation-test@continuity.invalid" },
);
assert.notEqual(otherOwner.status, 0);
assert.match(otherOwner.text, /Workspace not found or unavailable/);
const otherOrg = cli(
  "get-workspace-context",
  { workspaceId },
  { AGENT_ORG_ID: "continuity-isolation-test-org" },
);
assert.notEqual(otherOrg.status, 0);
assert.match(otherOrg.text, /Workspace not found or unavailable/);

mkdirSync(".tmp", { recursive: true });
writeFileSync(
  ".tmp/foundation-context.json",
  JSON.stringify(
    {
      workspaceId,
      selectedPersonId: alex.id,
      ownerEmail: membership.email,
      orgId: membership.orgId,
      snapshot: first.body,
    },
    null,
    2,
  ),
);

console.log(
  JSON.stringify(
    {
      passed: true,
      workspaceId,
      people: first.body.people.length,
      systems: first.body.systems.length,
      checks: [
        "HTTP and CLI shared data",
        "idempotent seed",
        "selected person",
        "missing person rejection",
        "authentication",
        "owner isolation",
        "organization isolation",
      ],
    },
    null,
    2,
  ),
);
