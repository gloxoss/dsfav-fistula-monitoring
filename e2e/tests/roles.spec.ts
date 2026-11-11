import { expect, test, type APIRequestContext } from "@playwright/test";

const API_URL = process.env.API_URL ?? "http://localhost:3101";
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

function webUrl(path: string) {
  return new URL(path, WEB_URL).toString();
}

const roles = [
  {
    id: "nurse",
    home: "/capture",
    allowed: ["/capture", "/dashboard", "/patients", "/devices"],
    refused: ["/training-bench", "/notes", "/baseline-history", "/bench-history", "/settings/clinical", "/admin/audit", "/admin/users"],
  },
  {
    id: "nephro",
    home: "/dashboard",
    allowed: ["/dashboard", "/patients", "/notes", "/baseline-history", "/devices", "/settings/clinical", "/admin/audit", "/bench-history"],
    refused: ["/capture", "/training-bench", "/admin/users"],
  },
  {
    id: "intern",
    home: "/training-bench",
    allowed: ["/training-bench", "/bench-history"],
    refused: ["/capture", "/dashboard", "/patients", "/notes", "/baseline-history", "/devices", "/settings/clinical", "/admin/audit", "/admin/users"],
  },
  {
    id: "admin",
    home: "/devices",
    allowed: ["/devices", "/settings/clinical", "/admin/audit", "/admin/users"],
    refused: ["/capture", "/dashboard", "/patients", "/notes", "/baseline-history", "/training-bench", "/bench-history"],
  },
] as const;

for (const role of roles) {
  test(`[AUTHZ-MATRIX] ${role.id} opens allowed pages, is redirected from refused pages, and logs out`, async ({ page, request }) => {
    await expectApiPolicy(request, role.id);
    await page.goto(webUrl("/login"));
    await page.getByLabel(/identifiant/i).fill(`${role.id}@dsfav.local`);
    await page.getByLabel(/mot de passe/i).fill("demo1234");
    await page.getByRole("button", { name: /se connecter/i }).click();
    await expect(page).toHaveURL(new RegExp(`${role.home.replaceAll("/", "\\/")}$`));

    for (const route of role.allowed) {
      await page.goto(webUrl(route));
      await expect(page).toHaveURL(new RegExp(`${route.replaceAll("/", "\\/")}$`));
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    }

    for (const route of role.refused) {
      await page.goto(webUrl(route));
      await expect.poll(() => {
        const current = new URL(page.url());
        return { pathname: current.pathname, forbidden: current.searchParams.get("forbidden") };
      }).toEqual({ pathname: role.home, forbidden: "1" });
      await expect(page.getByText("Accès refusé pour ce profil")).toContainText("Accès refusé pour ce profil");
    }

    await page.getByRole("button", { name: "Déconnexion" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto(webUrl(role.home));
    await expect(page).toHaveURL(/\/login\?/);
  });
}

async function expectApiPolicy(request: APIRequestContext, role: string) {
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { email: `${role}@dsfav.local`, password: "demo1234" },
  });
  expect(login.ok(), `API login for ${role}`).toBeTruthy();
  const { token } = await login.json() as { token: string };
  const routes = [
    ["/audit", ["nephro", "admin"]],
    ["/users", ["admin"]],
    ["/devices", ["nurse", "nephro", "admin"]],
    ["/bench/sessions", ["nephro", "intern"]],
    ["/patients/PT-CAS-8841/notes", ["nephro"]],
    ["/patients/PT-CAS-8841/follow-ups", ["nephro"]],
    ["/patients/PT-CAS-8841/baseline-versions", ["nephro"]],
  ] as const;
  for (const [path, allowedRoles] of routes) {
    const response = await request.get(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status(), `${role} -> ${path}`).toBe((allowedRoles as readonly string[]).includes(role) ? 200 : 403);
  }
}
