import { expect, test } from "@playwright/test";
import { resolve as resolvePath } from "node:path";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

function webUrl(path: string) {
  return new URL(path, WEB_URL).toString();
}

function screenshotPath(filename: string) {
  return resolvePath(__dirname, "../../docs/visual/screens", filename);
}

test.describe("Visual shots", () => {
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test("[VISUAL] captures demo result and patient screens into visual-shots", async ({ page }) => {
    // Set desktop viewport (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Log in as nurse
    await page.goto(webUrl("/login"));
    await page.getByLabel(/identifiant/i).fill("nurse@dsfav.local");
    await page.getByLabel(/mot de passe/i).fill("demo1234");
    await page.getByRole("button", { name: /se connecter/i }).click();
    await expect(page).toHaveURL(/capture$/);

    // 2. Turn demo mode on
    const demoToggle = page.getByRole("button", { name: /mode démonstration/i });
    await expect(demoToggle).toBeVisible();
    await demoToggle.click();

    // 2b. Mid-capture shot while streaming (around 6 seconds in)
    await page.waitForTimeout(6000);
    await page.screenshot({ path: screenshotPath("after-capture-mid.png"), fullPage: true });

    // 3. Wait for playback to finish and result card to display
    const resultCard = page.getByText(/durée propre/i);
    await expect(resultCard).toBeVisible({ timeout: 45_000 });

    // 4. Save after-capture.png (desktop)
    await page.screenshot({ path: screenshotPath("after-capture.png"), fullPage: true });

    // Save after-capture-mobile.png (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: screenshotPath("after-capture-mobile.png"), fullPage: true });

    // Reset to desktop for navigation
    await page.setViewportSize({ width: 1440, height: 900 });

    // 5. Navigate to patient details (PT-CAS-8841)
    await page.goto(webUrl("/patients/PT-CAS-8841"));
    await expect(page.getByRole("heading", { name: /suivi/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "RMS par séance" })).toBeVisible({ timeout: 15_000 });
    await page.waitForSelector(".recharts-surface, .recharts-wrapper", { timeout: 15_000 });
    await page.waitForTimeout(1000);

    // 6. Save after-patient.png (desktop)
    await page.screenshot({ path: screenshotPath("after-patient.png"), fullPage: true });

    // Save after-patient-mobile.png (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: screenshotPath("after-patient-mobile.png"), fullPage: true });

    // 7. Dashboard view (PT list / queue)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(webUrl("/dashboard"));
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: screenshotPath("after-dashboard.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: screenshotPath("after-dashboard-mobile.png"), fullPage: true });

    // 8. Clinical settings (log in as nephro)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.context().clearCookies();
    await page.goto(webUrl("/login"));
    await page.getByLabel(/identifiant/i).fill("nephro@dsfav.local");
    await page.getByLabel(/mot de passe/i).fill("demo1234");
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL(/dashboard|patients|capture/, { timeout: 15_000 });
    await page.goto(webUrl("/settings/clinical"));
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: screenshotPath("after-settings.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: screenshotPath("after-settings-mobile.png"), fullPage: true });
  });
});
