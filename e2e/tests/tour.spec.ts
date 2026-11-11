import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Screenshot tour of every page for every role that can open it.
// Run: WEB_URL=http://localhost:3000 pnpm --filter ./e2e exec playwright test tests/tour.spec.ts --workers=1 --timeout=240000
const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const OUT = resolve(__dirname, "../../docs/visual/screens");

interface Stop { name: string; path: string; }
const ROLES: Array<{ id: string; stops: Stop[] }> = [
  { id: "nurse", stops: [
    { name: "capture", path: "/capture" },
    { name: "dashboard", path: "/dashboard" },
    { name: "patients", path: "/patients" },
    { name: "patient-detail", path: "/patients/PT-CAS-8841" },
    { name: "devices", path: "/devices" },
  ] },
  { id: "nephro", stops: [
    { name: "dashboard", path: "/dashboard" },
    { name: "settings", path: "/settings/clinical" },
    { name: "notes", path: "/notes" },
    { name: "baseline-history", path: "/baseline-history" },
    { name: "bench-history", path: "/bench-history" },
    { name: "audit", path: "/admin/audit" },
  ] },
  { id: "intern", stops: [{ name: "training-bench", path: "/training-bench" }, { name: "bench-history", path: "/bench-history" }] },
  { id: "admin", stops: [
    { name: "devices", path: "/devices" },
    { name: "users", path: "/admin/users" },
    { name: "audit", path: "/admin/audit" },
    { name: "settings", path: "/settings/clinical" },
  ] },
];

async function login(page: Page, role: string) {
  await page.goto(`${WEB}/login`);
  await page.getByLabel(/identifiant/i).fill(`${role}@dsfav.local`);
  await page.getByLabel(/mot de passe/i).fill("demo1234");
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 90000 });
}

test.describe("Screenshot tour", () => {
  test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

  test("login and forbidden pages", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${WEB}/login`);
    await expect(page.getByRole("button", { name: /se connecter/i })).toBeVisible({ timeout: 90000 });
    await page.screenshot({ path: `${OUT}/tour-login.png`, fullPage: true });
    await login(page, "intern");
    await page.goto(`${WEB}/patients`);
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({ path: `${OUT}/tour-forbidden.png`, fullPage: true });
  });

  for (const role of ROLES) {
    test(`tour ${role.id}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await login(page, role.id);
      for (const stop of role.stops) {
        await page.goto(`${WEB}${stop.path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.locator("h1").first().waitFor({ timeout: 90000 });
        if (role.id === "nurse" && stop.name === "capture") {
          const demo = page.getByText(/mode démonstration/i).first();
          if (await demo.isVisible()) {
            await demo.click();
            await page.waitForTimeout(9000);
          }
        }
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${OUT}/tour-${role.id}-${stop.name}.png`, fullPage: true });
      }
    });
  }
});
