import { expect, test, type APIRequestContext } from "@playwright/test";
import { resolve as resolvePath } from "node:path";
import { spawn } from "node:child_process";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.API_URL ?? "http://localhost:3101";
const PASSWORD = "demo1234";
const PATIENT = "PT-CAS-8841";

test.describe.configure({ mode: "serial" });

type Login = { token: string };
type SimEvent = Record<string, unknown>;

async function login(request: APIRequestContext, user: string) {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: { email: `${user}@dsfav.local`, password: PASSWORD },
  });
  expect(response.ok(), `login for seeded ${user} account`).toBeTruthy();
  return (await response.json()) as Login;
}

async function runScenario(scenario: string, user = "nurse", patient: string | null = PATIENT) {
  return await new Promise<SimEvent[]>((resolve, reject) => {
    const args = [
      "run", "--project", resolvePath(process.cwd(), "..", "scripts", "simulator"), "--no-sync", "dsfav-sim",
      "--device", "DSFAV-UNIT-01", "--scenario", scenario,
      "--api", API_URL, "--speed", "50", "--headless-capture",
      "--user", user, "--password", PASSWORD,
    ];
    if (patient) args.push("--patient", patient);
    const child = spawn("uv", args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DEVICE_TOKENS: "DSFAV-UNIT-01=dev-token-unit-01",
        UV_CACHE_DIR: resolvePath(process.env.TEMP ?? process.cwd(), "dsfav-uv-cache"),
      },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      const events = stdout.split(/\r?\n/).flatMap((line) => {
        try { return [JSON.parse(line) as SimEvent]; } catch { return []; }
      });
      if (code !== 0) reject(new Error(`simulator ${scenario} exited ${code}: ${stderr}\n${stdout}`));
      else resolve(events);
    });
  });
}

function uploadResult(events: SimEvent[]) {
  return [...events].reverse().find((event) => "status_code" in event);
}

function expectUploadAccepted(events: SimEvent[]) {
  expect(uploadResult(events), "simulator raw upload response").toMatchObject({ status_code: 200 });
}

test("[UC1] Demo step 1: seeded users and patient data are available", async ({ request }) => {
  for (const user of ["nurse", "nephro", "intern", "admin"]) await login(request, user);
  const nurse = await login(request, "nurse");
  const patients = await request.get(`${API_URL}/patients`, {
    headers: { Authorization: `Bearer ${nurse.token}` },
  });
  expect(patients.ok()).toBeTruthy();
  expect(JSON.stringify(await patients.json())).toContain(PATIENT);
});

test("[UC1] Demo step 2: normal simulator capture is accepted for an established baseline", async () => {
  const events = await runScenario("normal");
  expect(events.some((event) => event.type === "rawUpload")).toBeTruthy();
  expectUploadAccepted(events);
});

test("[UC2] [UC3] Demo step 3: low pressure is rejected, then normal pressure succeeds", async () => {
  const low = await runScenario("low_pressure");
  expectUploadAccepted(low);
  expect(JSON.stringify(uploadResult(low))).toMatch(/PRESSURE|pressure|rejected/i);
  const recovered = await runScenario("normal");
  expect(recovered.some((event) => event.type === "rawUpload")).toBeTruthy();
  expectUploadAccepted(recovered);
});

test("[UC4] Demo step 4: short motion burst keeps a clean capture", async () => {
  const events = await runScenario("motion_short");
  expect(events.some((event) => event.type === "rawUpload")).toBeTruthy();
  expectUploadAccepted(events);
  expect(JSON.stringify(uploadResult(events))).not.toMatch(/REJECTED_QUALITY/);
});

test("[UC4] Demo step 5: heavy motion rejects the capture for quality", async () => {
  const events = await runScenario("motion_heavy");
  expectUploadAccepted(events);
  expect(JSON.stringify(uploadResult(events))).toMatch(/ARTIFACT|REJECTED_QUALITY|rejected/i);
});

test("[UC6] [UC9] Demo step 6: repeated stenotic captures produce a confirmation or evolution status", async () => {
  const first = await runScenario("stenotic");
  const second = await runScenario("stenotic");
  expectUploadAccepted(first);
  expectUploadAccepted(second);
  expect(JSON.stringify([uploadResult(first), uploadResult(second)])).toMatch(/TO_CONFIRM|UNUSUAL_EVOLUTION|confirmer|inhabituelle/i);
});

test("[UC8] [DISCLAIMER] Demo step 7: nephrologist sees patient history and the required disclaimer", async ({ page, request }) => {
  const nephrologist = await login(request, "nephro");
  await page.context().addCookies([{
    name: "dsfav_session",
    value: nephrologist.token,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  }]);
  await page.goto(`${BASE_URL}/patients/${PATIENT}`);
  await expect(page.getByText(PATIENT)).toBeVisible();
  await expect(page.getByText("Aide à la décision uniquement : la décision d’un examen écho-Doppler reste médicale.")).toBeVisible();
});

test("[NO-LOSS] Demo step 8: simulated device link drop stops before raw upload", async () => {
  const events = await runScenario("drop");
  expect(events.some((event) => event.type === "connectionDropped")).toBeTruthy();
  expect(events.some((event) => event.type === "rawUpload")).toBeFalsy();
});

