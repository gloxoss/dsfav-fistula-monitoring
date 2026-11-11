import { expect, test } from "@playwright/test";

const API_URL = process.env.API_URL ?? "http://localhost:3101";

test("[UC10] [UC11] Bench scenario: palpation must be saved before objective data can be revealed", async ({ request }) => {
  const loginResponse = await request.post(`${API_URL}/auth/login`, {
    data: { email: "intern@dsfav.local", password: "demo1234" },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const { token } = await loginResponse.json() as { token: string };
  const headers = { Authorization: `Bearer ${token}` };

  const created = await request.post(`${API_URL}/bench/sessions`, {
    headers,
    data: { pumpFlowMlMin: 500, clampStenosisPct: 30 },
  });
  expect(created.status()).toBe(201);
  const session = await created.json() as { id: string };

  const prematureReveal = await request.post(`${API_URL}/bench/sessions/${session.id}/capture`, {
    headers,
    data: { measurementId: "00000000-0000-4000-8000-000000000001" },
  });
  expect([403, 409]).toContain(prematureReveal.status());
  expect(JSON.stringify(await prematureReveal.json())).toMatch(/PALPATION_REQUIRED|palpation/i);

  const palpation = await request.post(`${API_URL}/bench/sessions/${session.id}/palpation`, {
    headers,
    data: { perceivedThrill: "CONTINUOUS_SOFT", perceivedIntensity: 3, internNotes: "" },
  });
  expect(palpation.ok()).toBeTruthy();
  expect(JSON.stringify(await palpation.json())).toMatch(/CONTINUOUS_SOFT/);
});

