import { expect, test, type Page } from "@playwright/test";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

function webUrl(path: string) {
  return new URL(path, WEB_URL).toString();
}

test.describe.configure({ mode: "serial", timeout: 90000 });

async function loginAs(page: Page, role: "nurse" | "nephro" | "intern" | "admin") {
  await page.goto(webUrl("/login"));
  await page.getByLabel(/identifiant/i).fill(`${role}@dsfav.local`);
  await page.getByLabel(/mot de passe/i).fill("demo1234");
  const targetPattern =
    role === "nurse"
      ? /\/capture$/
      : role === "nephro"
        ? /\/dashboard$/
        : role === "intern"
          ? /\/training-bench$/
          : /\/devices$/;
  await Promise.all([
    page.waitForURL(targetPattern, { timeout: 20000 }),
    page.getByRole("button", { name: /se connecter/i }).click(),
  ]);
}

async function logout(page: Page) {
  const logoutBtn = page.getByRole("button", { name: /déconnexion/i });
  if (await logoutBtn.isVisible()) {
    await Promise.all([
      page.waitForURL(/\/login$/, { timeout: 20000 }),
      logoutBtn.click(),
    ]);
  }
}

async function auditPageA11y(page: Page, path: string) {
  // 1. Exactly one h1 per page with non-empty content
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1.first()).toBeVisible({ timeout: 15000 });
  const h1Count = await h1.count();
  expect(
    h1Count,
    `Page ${path} must have exactly one <h1> heading (found ${h1Count})`,
  ).toBe(1);
  const h1Text = (await h1.first().textContent())?.trim() ?? "";
  expect(h1Text.length, `Page ${path} <h1> heading text must not be empty`).toBeGreaterThan(0);

  // 2. All visible buttons have accessible name (excluding Next.js dev tools)
  const buttons = await page.getByRole("button").all();
  for (const btn of buttons) {
    if (await btn.isVisible()) {
      const text = (await btn.textContent()) ?? "";
      if (text.includes("Next.js")) continue;
      const name = await btn.evaluate((el) => {
        return (
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.textContent?.trim() ||
          ""
        );
      });
      expect(
        name.trim().length,
        `Visible button on ${path} must have an accessible name`,
      ).toBeGreaterThan(0);
    }
  }

  // 3. All visible images have alt text or aria-label
  const images = await page.locator("img").all();
  for (const img of images) {
    if (await img.isVisible()) {
      const hasAlt = await img.evaluate((el) => {
        const image = el as HTMLImageElement;
        return (
          image.hasAttribute("alt") ||
          image.hasAttribute("aria-label") ||
          image.getAttribute("role") === "presentation"
        );
      });
      expect(hasAlt, `Image on ${path} must have alt or aria-label`).toBe(true);
    }
  }

  // 4. Form inputs have accessible labels
  const inputs = await page
    .locator("input:not([type='hidden']):not([tabindex='-1']), textarea, select")
    .all();
  for (const input of inputs) {
    if (await input.isVisible()) {
      const hasLabel = await input.evaluate((el) => {
        const inputEl = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        if ("labels" in inputEl && inputEl.labels && inputEl.labels.length > 0) return true;
        if (inputEl.getAttribute("aria-label") || inputEl.getAttribute("aria-labelledby")) return true;
        if (inputEl.closest("label")) return true;
        if (inputEl.getAttribute("placeholder")) return true;
        return false;
      });
      const inputId = (await input.getAttribute("id")) ?? (await input.getAttribute("name")) ?? "input";
      expect(hasLabel, `Form control #${inputId} on ${path} must have an accessible label`).toBe(true);
    }
  }

  // 5. No duplicate role=alert elements
  const alerts = await page.getByRole("alert").all();
  const appAlerts: string[] = [];
  for (const alert of alerts) {
    if (await alert.isVisible()) {
      const text = (await alert.textContent())?.trim() ?? "";
      if (text.length > 0 && !text.includes("Next.js")) {
        appAlerts.push(text);
      }
    }
  }
  const unique = new Set(appAlerts);
  expect(unique.size, `Duplicate role=alert notices detected on ${path}`).toBe(appAlerts.length);
}

async function auditKeyboardNavigation(page: Page, path: string) {
  // Ensure the page main content is loaded before keyboard tests
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1.first()).toBeVisible({ timeout: 15000 });

  await page.locator("body").click();

  let interactiveFound = 0;
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    const activeInfo = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) return null;
      const tag = active.tagName.toLowerCase();
      const isInteractive =
        ["a", "button", "input", "textarea", "select"].includes(tag) ||
        active.hasAttribute("tabindex") ||
        active.getAttribute("role") === "button" ||
        active.getAttribute("role") === "radio";

      const style = window.getComputedStyle(active);
      const hasFocusIndicator =
        style.outlineStyle !== "none" ||
        style.boxShadow !== "none" ||
        active.className.includes("focus") ||
        active.className.includes("ring");

      return { tag, isInteractive, hasFocusIndicator };
    });

    if (activeInfo && activeInfo.isInteractive) {
      interactiveFound++;
      expect(
        activeInfo.hasFocusIndicator,
        `Element <${activeInfo.tag}> focused by Tab on ${path} must have visible focus style`,
      ).toBe(true);
    }
  }
  expect(
    interactiveFound,
    `Page ${path} must have interactive elements reachable by keyboard Tab`,
  ).toBeGreaterThan(0);
}

test.describe("Accessibility and keyboard navigation checks", () => {
  test("[UC10] an accessibility check finds no serious violation on each main page", async ({ page }) => {
    // 1. Public /login
    await page.goto(webUrl("/login"));
    await auditPageA11y(page, "/login");

    // 2. Intern: /training-bench
    await loginAs(page, "intern");
    await auditPageA11y(page, "/training-bench");
    await logout(page);

    // 3. Nurse: /capture and /dashboard
    await loginAs(page, "nurse");
    await page.goto(webUrl("/capture"));
    await auditPageA11y(page, "/capture");
    await page.goto(webUrl("/dashboard"));
    await auditPageA11y(page, "/dashboard");
    await logout(page);

    // 4. Nephrologist: /patients
    await loginAs(page, "nephro");
    await page.goto(webUrl("/patients"));
    await auditPageA11y(page, "/patients");
    await logout(page);

    // 5. Admin: /devices
    await loginAs(page, "admin");
    await page.goto(webUrl("/devices"));
    await auditPageA11y(page, "/devices");
    await logout(page);
  });

  test("[UC10] all interactive elements are reachable by keyboard", async ({ page }) => {
    // 1. Public /login
    await page.goto(webUrl("/login"));
    await auditKeyboardNavigation(page, "/login");

    // 2. Intern: /training-bench
    await loginAs(page, "intern");
    await page.goto(webUrl("/training-bench"));
    await auditKeyboardNavigation(page, "/training-bench");
    await logout(page);

    // 3. Nurse: /capture
    await loginAs(page, "nurse");
    await page.goto(webUrl("/capture"));
    await auditKeyboardNavigation(page, "/capture");
    await logout(page);
  });
});
