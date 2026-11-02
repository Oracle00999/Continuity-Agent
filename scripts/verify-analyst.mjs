import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

// Run after smoke-foundation.mjs, with the dev server stopped so the app-agent
// loop can open the same local PGlite database. This makes one real model run.
const saved = JSON.parse(readFileSync(".tmp/foundation-context.json", "utf8"));
writeFileSync(".tmp/analyst-cli-output.txt", "");
writeFileSync(".tmp/analyst-cli-diagnostic.txt", "");
const model = process.argv[2] ?? "gpt-5-mini";
const prompt = `You are Continuity Analyst. Call get-workspace-context with workspaceId ${saved.workspaceId} and selectedPersonId ${saved.selectedPersonId}. Summarize the selected person's saved name, role, departure date, and the six saved systems. Include the exact workspace and person IDs. State that ownership and readiness have not been assessed. Make no changes and do not call any other tool.`;
const child = spawn(
  process.execPath,
  [
    "--import",
    "tsx",
    "node_modules/@agent-native/core/bin/agent-native.js",
    "agent",
    prompt,
    "--engine",
    "ai-sdk:openai",
    "--model",
    model,
    "--user-email",
    saved.ownerEmail,
    "--org-id",
    saved.orgId ?? "",
    "--max-iterations",
    "4",
    "--json",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
let diagnostic = "";
let payload;
const exitCode = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    diagnostic += "\nAgent CLI timed out before completing the live proof.";
    child.kill("SIGTERM");
  }, 180_000);
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    output += chunk;
    writeFileSync(".tmp/analyst-cli-output.txt", output);
    try {
      const candidate = JSON.parse(output.slice(output.indexOf("{")));
      if (Array.isArray(candidate.events)) {
        payload = candidate;
        // The CLI may retain database worker handles after printing its final
        // result. Once the complete proof is received, release this test child.
        child.kill("SIGTERM");
      }
    } catch {
      /* A streamed JSON result is not complete yet. */
    }
  });
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    diagnostic += chunk.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
    writeFileSync(".tmp/analyst-cli-diagnostic.txt", diagnostic);
  });
  child.on("error", (error) => {
    clearTimeout(timer);
    reject(error);
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    resolve(code);
  });
});
if (!payload || payload.failure) {
  // The framework redacts credentials from errors. Do not dump raw environment.
  console.error(
    diagnostic.trim() ||
      `Agent CLI ended with code ${exitCode} before returning proof.`,
  );
  process.exitCode = 1;
} else {
  const completed = payload.events.filter(
    (event) =>
      event.type === "tool_done" &&
      event.tool === "get-workspace-context" &&
      !event.isError,
  );
  assert.ok(
    completed.length > 0,
    "The model must actually call the registered workspace action",
  );
  assert.ok(
    completed.some(
      (event) =>
        event.result.includes(saved.workspaceId) &&
        event.result.includes(saved.selectedPersonId),
    ),
    "Tool output must match the HTTP workspace snapshot",
  );
  const toolContext = JSON.parse(completed[0].result);
  assert.deepEqual(toolContext, {
    ...saved.snapshot,
    selectedPerson: saved.snapshot.people.find((person) => person.id === saved.selectedPersonId),
  }, "The live agent tool must return exactly the same saved records as HTTP");
  assert.ok(payload.responseText.includes(saved.workspaceId));
  assert.ok(payload.responseText.includes(saved.selectedPersonId));
  assert.ok(payload.responseText.includes("Alex Morgan"));
  writeFileSync(".tmp/analyst-proof.json", JSON.stringify(payload, null, 2));
  console.log(
    JSON.stringify(
      {
        passed: true,
        model,
        action: "get-workspace-context",
        workspaceId: saved.workspaceId,
        selectedPersonId: saved.selectedPersonId,
        response: payload.responseText,
      },
      null,
      2,
    ),
  );
}
