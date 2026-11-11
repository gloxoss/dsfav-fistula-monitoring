import { expect, test } from "@playwright/test";

const WEB_URL = process.env.WEB_URL;

test.skip(!WEB_URL, "WEB_URL not set: skipping e2e smoke test");

test("[E2E] dashboard page renders a heading", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
