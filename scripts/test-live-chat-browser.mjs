import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

// Explicitly opt-in: contacts the app's configured model and saves a QA chat.
import { chromium, expect } from "@playwright/test";
if (!process.argv.includes("--approved-live-chat")) {
  throw new Error(
    "Live chat approval required: this sends workspace context to the configured model provider and persists a QA thread.",
  );
}
await mkdir(".tmp/visual/live-chat", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
  });
  const errors = [];
  let submissions = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/_agent-native/agent-chat"
    )
      submissions++;
  });
  const auth = await page.request.post(
    "http://localhost:8080/_agent-native/auth/local-dev",
  );
  assert.equal(auth.status(), 200);
  await page.goto("http://localhost:8080/chat");
  const composer = page.getByRole("textbox", {
    name: "Message agent",
    exact: true,
  });
  await expect(composer).toBeVisible({ timeout: 60000 });
  await composer.fill(
    "[QA browser keyboard check] Read-only test. Say hello briefly and provide two suggested follow-ups that only explain existing workspace information. Do not create, update, delete, approve, assign or resolve business data.",
  );
  await composer.press("Enter");
  const chips = page.locator("[data-agent-suggestion-chip]");
  await expect(chips.first()).toBeVisible({ timeout: 120000 });
  const safe = chips
    .filter({ hasText: /^(show|view|explain|list|read)\b/i })
    .filter({
      hasNotText:
        /create|update|delete|approve|assign|resolve|generate|extract|start|save/i,
    })
    .first();
  await expect(safe).toBeVisible();
  await page.screenshot({ path: ".tmp/visual/live-chat/before.png" });
  const before = submissions;
  await safe.click();
  await expect(composer).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => submissions).toBe(before + 1);
  // Observe the interval in which an accidental second activation would submit.
  await page.waitForTimeout(2000);
  assert.equal(
    submissions,
    before + 1,
    "Enter must not submit another suggestion",
  );
  await page.screenshot({ path: ".tmp/visual/live-chat/after.png" });
  assert.deepEqual(errors, [], "Unexpected browser JavaScript errors");
  console.log(
    "PASS: suggestion selection focuses composer; subsequent Enter produces no extra submission.",
  );
} finally {
  await browser.close();
}
