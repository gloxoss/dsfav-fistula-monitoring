import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { DISCLAIMER } from "../../apps/web-nextjs/src/libs/clinical/disclaimer";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.API_URL ?? "http://localhost:3101";
const BROWSER_API_URL = process.env.NEXT_PUBLIC_API_URL ?? API_URL;
const PASSWORD = "demo1234";
const PATIENT = "PT-CAS-8841";

type Login = { token: string };

async function login(request: APIRequestContext): Promise<Login> {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: { email: "nurse@dsfav.local", password: PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Login;
}

async function loginThroughUi(page: Page) {
  const response = await page.request.post(`${BASE_URL}/api/session`, {
    data: { identifier: "nurse@dsfav.local", password: PASSWORD },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  await page.goto(`${BASE_URL}/capture`);
  await expect(page.getByRole("heading", { name: /Acquisition/ })).toBeVisible({ timeout: 60_000 });
}

test("[NO-LOSS] control: nurse can open capture without network interception", async ({ page }) => {
  test.setTimeout(75_000);
  await loginThroughUi(page);
});

test("[NO-LOSS] [DISCLAIMER] capture reload and re-login resumes one measurement", async ({ page, request }) => {
  test.setTimeout(120_000);
  page.on("console", (message) => {
    if (message.type() === "error") console.error(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    console.error(`pageerror: ${error.stack ?? error.message}`);
  });
  let token = (await login(request)).token;
  const auth = { Authorization: `Bearer ${token}` };
  const devicesResponse = await request.get(`${API_URL}/devices`, { headers: auth });
  expect(devicesResponse.ok()).toBeTruthy();
  const devices = (await devicesResponse.json()) as Array<{ id: string; serialNumber: string }>;
  const device = devices.find((candidate) => candidate.serialNumber === "DSFAV-UNIT-01");
  expect(device).toBeDefined();
  if (!device) throw new Error("Seeded capture device is unavailable");

  const createdResponse = await request.post(`${API_URL}/measurements`, {
    headers: auth,
    data: { idPseudo: PATIENT, deviceId: device.id },
  });
  expect(createdResponse.status()).toBe(201);
  const created = (await createdResponse.json()) as { measurementId: string };
  const measurementId = created.measurementId;
  const resume = {
    measurementId,
    idPseudo: PATIENT,
    deviceId: device.id,
    startedAt: new Date().toISOString(),
    lastState: "capturing",
  };

  await page.addInitScript((saved) => {
    window.sessionStorage.setItem("dsfav.capture.resume", JSON.stringify(saved));
  }, resume);

  let resumeLookupAvailable = false;
  await page.route(`${BROWSER_API_URL}/measurements/${measurementId}`, async (route) => {
    if (!resumeLookupAvailable) {
      await route.abort();
      return;
    }
    const response = await request.get(`${API_URL}/measurements/${measurementId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok()) console.error(`resume lookup API status: ${response.status()}`);
    await route.fulfill({ response });
  });
  let createCalls = 0;
  await page.route(`${BROWSER_API_URL}/measurements`, async (route) => {
    if (route.request().method() === "POST") createCalls += 1;
    await route.continue();
  });

  await loginThroughUi(page);
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("dsfav.capture.resume")))
    .toContain(measurementId);
  await expect(page.getByTestId("capture-measurement-id")).toContainText(measurementId, { timeout: 20_000 });
  await expect(page.getByText(DISCLAIMER)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /Acquisition/ })).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("dsfav.capture.resume")))
    .toContain(measurementId);

  token = (await login(request)).token;
  await page.context().clearCookies();
  resumeLookupAvailable = true;
  await loginThroughUi(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Acquisition/ })).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("dsfav.capture.resume")))
    .toContain(measurementId);
  await expect(page.getByTestId("capture-measurement-id")).toContainText(measurementId, { timeout: 20_000 });
  expect(createCalls).toBe(0);

  const storedResponse = await request.get(`${API_URL}/measurements/${measurementId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(storedResponse.ok()).toBeTruthy();
  expect(await storedResponse.json()).toMatchObject({ measurementId });
});
