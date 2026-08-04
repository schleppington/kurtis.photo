import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const collectionPath = "/places/yosemite";

async function openCollection(page) {
  await page.goto(collectionPath, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Yosemite" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function openViewer(page) {
  await openCollection(page);
  await page.locator(".photo-tile").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("site navigation and photo viewing", () => {
  test("navigates from the home page through the place archive", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/kurtis\.photo/i);

    await page.getByRole("link", { name: /Photo index/ }).click();
    await expect(page).toHaveURL(/\/places$/);
    await expect(page.getByRole("heading", { name: "Places", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Yosemite" }).first().click();
    await expect(page).toHaveURL(/\/places\/yosemite$/);
    await expect(page.getByRole("heading", { name: "Yosemite" })).toBeVisible();
  });

  test("opens the photo viewer and supports keyboard navigation", async ({ page }) => {
    const dialog = await openViewer(page);

    await expect(dialog.locator(".text-button")).toBeFocused();
    await expect(dialog.locator(".viewer-topbar span")).toHaveText(/01\s*\//);

    await page.keyboard.press("ArrowRight");
    await expect(dialog.locator(".viewer-topbar span")).toHaveText(/02\s*\//);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/places\/yosemite$/);
  });

  test("browser back closes the viewer without losing the collection", async ({ page }) => {
    await openViewer(page);
    await expect(page).toHaveURL(/\/places\/yosemite\/[^/]+$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/places\/yosemite$/);
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("heading", { name: "Yosemite" })).toBeVisible();
  });

  test("supports tap-based photo viewing on a mobile viewport", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile-chromium", "Tap behavior is covered by the mobile Chromium project.");

    await openCollection(page);
    const firstTile = page.locator(".photo-tile").first();
    await firstTile.tap();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator(".text-button").tap();
    await expect(dialog).toBeHidden();
  });
});

test.describe("accessibility", () => {
  for (const path of ["/", "/places", collectionPath, "/portraits", "/prints"]) {
    test(`has no serious axe violations on ${path}`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toBeVisible();
      await page.waitForTimeout(path === "/" ? 1_000 : 250);

      const results = await new AxeBuilder({ page })
        .exclude(".maplibregl-canvas")
        .analyze();
      const seriousViolations = results.violations.filter(
        (violation) => violation.impact === "critical" || violation.impact === "serious",
      );

      expect(seriousViolations, JSON.stringify(seriousViolations, null, 2)).toEqual([]);
    });
  }
});

test("records a lightweight performance baseline for the home page", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const paintEntries = performance.getEntriesByType("paint");
    const resources = performance.getEntriesByType("resource");
    const layoutShifts = performance.getEntriesByType("layout-shift");

    return {
      domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? 0,
      loadMs: navigation?.loadEventEnd ?? 0,
      firstContentfulPaintMs: paintEntries.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? 0,
      imageBytes: resources
        .filter((entry) => entry.initiatorType === "img")
        .reduce((total, entry) => total + (entry.transferSize || 0), 0),
      scriptBytes: resources
        .filter((entry) => entry.initiatorType === "script")
        .reduce((total, entry) => total + (entry.transferSize || 0), 0),
      cumulativeLayoutShift: layoutShifts
        .filter((entry) => !entry.hadRecentInput)
        .reduce((total, entry) => total + entry.value, 0),
    };
  });

  test.info().annotations.push({
    type: "performance",
    description: JSON.stringify(metrics),
  });

  expect(metrics.domContentLoadedMs).toBeGreaterThan(0);
  expect(metrics.firstContentfulPaintMs).toBeGreaterThan(0);
  expect(metrics.loadMs).toBeLessThan(15_000);
});
