import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

import { chromium, expect } from "@playwright/test";
if (!process.argv.includes("--approved-live-chat"))
  throw new Error(
    "Requires approval for model context transfer and QA chat persistence.",
  );
await mkdir(".tmp/visual/chat-lifecycle", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "dark",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let threadId, currentRun;
const active = async () => {
  const response = await page.request.get(
    `http://localhost:8080/_agent-native/agent-chat/runs/active?threadId=${encodeURIComponent(threadId)}`,
  );
  assert.equal(response.status(), 200);
  return response.json();
};
try {
  assert.equal(
    (
      await page.request.post(
        "http://localhost:8080/_agent-native/auth/local-dev",
      )
    ).status(),
    200,
  );
  await page.goto("http://localhost:8080/");
  await expect(page).toHaveURL(/\/overview(?:[?#]|$)/, { timeout: 60000 });
  await expect(
    page.getByRole("heading", { name: "Northstar Digital", exact: true }),
  ).toBeVisible();
  console.log("PASS authenticated landing");
  await page.goto("http://localhost:8080/chat");
  const composer = page.getByRole("textbox", {
    name: "Message agent",
    exact: true,
  });
  await expect(composer).toBeVisible({ timeout: 60000 });
  await composer.fill(
    "[QA lifecycle test] Read-only test: explain in detail 100 general documentation review questions. Do not call tools or change any business data. This response will be stopped to test cancellation.",
  );
  await composer.press("Enter");
  await expect(page).toHaveURL(/\/chat\/[^/?]+/);
  threadId = new URL(page.url()).pathname.split("/").at(-1);
  await expect
    .poll(
      async () => {
        currentRun = await active();
        return currentRun.active;
      },
      { timeout: 45000 },
    )
    .toBe(true);
  assert.ok(currentRun.runId);
  console.log("PASS active run observed");
  const overlap = await page.request.post(
    "http://localhost:8080/_agent-native/agent-chat",
    {
      data: {
        threadId,
        message:
          "[QA rejected overlap] Reply READY only. Do not call tools or change business data.",
      },
      timeout: 20000,
    },
  );
  assert.equal(
    overlap.status(),
    409,
    "A simultaneous direct run must be rejected",
  );
  assert.equal((await overlap.json()).code, "run_slot_busy");
  console.log("PASS overlapping direct run rejected with run_slot_busy");
  await page.screenshot({ path: ".tmp/visual/chat-lifecycle/running.png" });
  const stop = page.getByRole("button", { name: "Stop response", exact: true });
  await expect(stop).toBeVisible();
  await stop.click();
  await expect
    .poll(async () => (await active()).active, { timeout: 45000 })
    .toBe(false);
  await expect(stop).not.toBeVisible({ timeout: 20000 });
  console.log("PASS stop button cancelled run and released slot");
  await composer.fill(
    "[QA cancellation recovery] Reply with exactly READY. Do not call tools or change any business data.",
  );
  const accepted = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/_agent-native/agent-chat" &&
      r.request().method() === "POST",
    { timeout: 45000 },
  );
  await composer.press("Enter");
  const recovery = await accepted;
  assert.equal(
    recovery.status(),
    200,
    "New run must be accepted after cancellation",
  );
  await expect
    .poll(
      async () => {
        const r = await active();
        return r.active;
      },
      { timeout: 120000 },
    )
    .toBe(false);
  await expect(page.getByText("READY", { exact: true }).last()).toBeVisible({
    timeout: 45000,
  });
  console.log("PASS follow-up completed after cancellation");
  await page.screenshot({ path: ".tmp/visual/chat-lifecycle/recovered.png" });
  assert.deepEqual(errors, []);
  await writeFile(
    ".tmp/visual/chat-lifecycle/result.json",
    JSON.stringify(
      {
        passed: [
          "authenticated landing",
          "overlap rejection",
          "UI cancellation releases slot",
          "new reply after cancellation",
        ],
        browserErrors: errors,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page
    .screenshot({ path: ".tmp/visual/chat-lifecycle/failure.png" })
    .catch(() => {});
  console.error(
    "Visible buttons:",
    await page
      .getByRole("button")
      .allTextContents()
      .catch(() => []),
  );
  throw error;
} finally {
  if (threadId) {
    const run = await active().catch(() => null);
    if (run?.active && run.runId)
      await page.request
        .post(
          `http://localhost:8080/_agent-native/agent-chat/runs/${encodeURIComponent(run.runId)}/abort`,
          { data: { reason: "user" } },
        )
        .catch(() => {});
  }
  await browser.close();
}
