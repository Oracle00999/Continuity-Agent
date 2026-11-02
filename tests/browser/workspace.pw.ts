import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  errors.set(page, []);
  page.on("pageerror", (error) => errors.get(page)!.push(error.message));
  const response = await page.request.post("/_agent-native/auth/local-dev");
  expect(response.status()).toBe(200);
});
test.afterEach(async ({ page }) => {
  expect(
    errors.get(page) ?? [],
    "Unexpected browser JavaScript errors",
  ).toEqual([]);
});
async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Page must not overflow horizontally",
  ).toBe(true);
  await mkdir(".tmp/visual/screenshots", { recursive: true });
  const file = path.resolve(
    `.tmp/visual/screenshots/${name}-${info.project.name}.png`,
  );
  await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
  await info.attach(`${name}-${info.project.name}`, {
    path: file,
    contentType: "image/png",
  });
}
test("Overview landing and responsive dashboard", async ({ page }, info) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/overview(?:[?#]|$)/);
  await expect(
    page.getByRole("heading", { name: "Northstar Digital", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Open risks", exact: true }),
  ).toBeAttached();
  await capture(page, info, "overview");
  if (info.project.name === "mobile") {
    // All summary links share the same grid; verify two columns on a phone.
    const grid = page
      .locator("a")
      .filter({ hasText: "Critical systems" })
      .locator("..");
    const cards = grid.locator(":scope > a");
    const a = await cards.nth(0).boundingBox();
    const b = await cards.nth(1).boundingBox();
    expect(
      a && b && Math.abs(a.y - b.y) < 2,
      "Mobile summaries should use two columns",
    ).toBeTruthy();
    await page.getByRole("button", { name: /Open navigation/i }).click();
    await expect(
      page.getByRole("link", { name: "Documents", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Documents", exact: true }).click();
    await expect(page).toHaveURL(/\/documents/);
  }
});
test("Workspace person selection", async ({ page }, info) => {
  await page.goto("/workspace");
  await page.getByRole("button", { name: /Maya Chen/ }).click();
  await expect(page).toHaveURL(/personId=/);
  await expect(page.getByRole("button", { name: /Maya Chen/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await capture(page, info, "workspace");
});
test("Document source and saved knowledge", async ({ page }, info) => {
  await page.goto("/documents");
  await page
    .getByRole("button", { name: /Database Backup & Restore\.md/ })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Database Backup & Restore.md",
      exact: true,
    }),
  ).toBeVisible();
  await capture(page, info, "document-source");
  await page.getByRole("button", { name: "Knowledge", exact: true }).click();
  await expect(
    page.getByText("Source-backed claims need review.", { exact: false }),
  ).toBeVisible();
  await page
    .locator("article")
    .filter({ hasText: "Alex Morgan" })
    .first()
    .scrollIntoViewIfNeeded();
  await capture(page, info, "document-knowledge");
});
test("Knowledge map selection and zoom", async ({ page }, info) => {
  await page.goto("/knowledge-map");
  await expect(
    page.getByRole("region", { name: /Knowledge connections/ }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: /Procedure PostgreSQL database backup schedule/,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "PostgreSQL database backup schedule",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reset zoom", exact: true }),
  ).toHaveText("75%");
  await capture(page, info, "knowledge-map");
});
test("Risk review preview does not save", async ({ page }, info) => {
  await page.goto("/risks");
  await page
    .getByRole("link", {
      name: /Backup location not specified in restore step/,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Backup location not specified in restore step",
      exact: true,
    }),
  ).toBeVisible();
  const id = new URL(page.url()).searchParams.get("findingId")!;
  const before = await page.request.get(
    `/_agent-native/actions/get-risk-finding?id=${encodeURIComponent(id)}`,
  );
  expect(before.ok()).toBe(true);
  const original = await before.json();
  await page
    .locator("summary")
    .filter({ hasText: "Review or correct" })
    .click();
  await page
    .getByRole("textbox", {
      name: "Explain your review, correction, or resolution",
      exact: true,
    })
    .fill("Visual preview only; this review will not be saved.");
  await expect(
    page.getByRole("button", { name: "Save review", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("textbox", {
      name: "Explain your review, correction, or resolution",
      exact: true,
    })
    .scrollIntoViewIfNeeded();
  await capture(page, info, "risk-review");
  const after = await page.request.get(
    `/_agent-native/actions/get-risk-finding?id=${encodeURIComponent(id)}`,
  );
  expect(await after.json()).toEqual(original);
});
test("Departure plan remains unapproved and task details open", async ({
  page,
}, info) => {
  await page.goto("/handover");
  await expect(
    page.getByRole("heading", { name: "Alex Morgan’s handover", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Approve plan and assignments",
      exact: true,
    }),
  ).toBeDisabled();
  await capture(page, info, "handover-plan");
  await page
    .getByRole("link", { name: "Review or edit task", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/tasks\?/);
  await expect(
    page.getByRole("heading", {
      name: "Original risk assessment",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Task description", exact: true })
    .scrollIntoViewIfNeeded();
  await capture(page, info, "plan-task");
});
test("Verification checklist details", async ({ page }, info) => {
  await page.goto("/verification");
  await expect(
    page.getByRole("heading", { name: "Start a procedure test", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /Database Backup & Restore\.md/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Database Backup & Restore.md",
      exact: true,
    }),
  ).toBeVisible();
  await capture(page, info, "verification");
});
