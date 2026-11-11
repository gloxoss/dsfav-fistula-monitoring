import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SEEDED_ACCOUNTS,
  decodeSessionToken,
  getRoleHome,
  getRoleLabel,
  isRouteAllowedForRole,
  signSessionToken,
  signWsToken,
  verifyJwt,
  verifySessionToken,
  type SessionUser,
  type UserRole,
} from "./session";

describe("Session & Role Routing", () => {
  it("[AUTHZ-MATRIX] maps each role to its dedicated home route", () => {
    const expectations: Record<UserRole, string> = {
      NURSE: "/capture",
      NEPHROLOGIST: "/dashboard",
      INTERN: "/training-bench",
      ADMIN: "/devices",
    };

    for (const [role, home] of Object.entries(expectations)) {
      expect(getRoleHome(role as UserRole)).toBe(home);
    }
  });

  it("[AUTHZ-MATRIX] enforces intern role cannot access patient routes", () => {
    expect(isRouteAllowedForRole("/training-bench", "INTERN")).toBe(true);
    expect(isRouteAllowedForRole("/patients", "INTERN")).toBe(false);
    expect(isRouteAllowedForRole("/patients/PT-CAS-8841", "INTERN")).toBe(false);
    expect(isRouteAllowedForRole("/capture", "INTERN")).toBe(false);

    expect(isRouteAllowedForRole("/patients", "NEPHROLOGIST")).toBe(true);
    expect(isRouteAllowedForRole("/capture", "NURSE")).toBe(true);
  });

  it("[AUTHZ-MATRIX] applies the same route policy to every role", () => {
    const routes: ReadonlyArray<readonly [string, readonly UserRole[]]> = [
      ["/capture", ["NURSE"]],
      ["/dashboard", ["NURSE", "NEPHROLOGIST"]],
      ["/patients", ["NURSE", "NEPHROLOGIST"]],
      ["/training-bench", ["INTERN"]],
      ["/devices", ["NURSE", "NEPHROLOGIST", "ADMIN"]],
      ["/settings/clinical", ["NEPHROLOGIST", "ADMIN"]],
      ["/admin/audit", ["NEPHROLOGIST", "ADMIN"]],
      ["/admin/users", ["ADMIN"]],
      ["/notes", ["NEPHROLOGIST"]],
      ["/baseline-history", ["NEPHROLOGIST"]],
      ["/bench-history", ["NEPHROLOGIST", "INTERN"]],
    ];

    for (const [route, allowedRoles] of routes) {
      for (const role of ["NURSE", "NEPHROLOGIST", "INTERN", "ADMIN"] as const) {
        expect(isRouteAllowedForRole(route, role), `${role} -> ${route}`).toBe(allowedRoles.includes(role));
      }
    }
  });

  it("returns French role labels correctly", () => {
    expect(getRoleLabel("NURSE")).toBe("Infirmière");
    expect(getRoleLabel("NEPHROLOGIST")).toBe("Néphrologue");
    expect(getRoleLabel("INTERN")).toBe("Interne");
    expect(getRoleLabel("ADMIN")).toBe("Administrateur");
  });

  it("creates and verifies cryptographically signed session tokens without personal data", () => {
    const user: SessionUser = {
      id: "usr-nephro-01",
      role: "NEPHROLOGIST",
    };
    const token = signSessionToken(user);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const verified = verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe("usr-nephro-01");
    expect(verified?.role).toBe("NEPHROLOGIST");
    // Hard rule: No personal data fields (no name, no initials)
    expect((verified as unknown as Record<string, unknown>).name).toBeUndefined();
    expect((verified as unknown as Record<string, unknown>).initials).toBeUndefined();
  });

  it("mints signed 60-second capture WebSocket tokens", () => {
    const user: SessionUser = {
      id: "usr-nurse-01",
      role: "NURSE",
    };
    const wsToken = signWsToken(user);
    const verified = verifyJwt<{ sub: string; role: string; scope: string; exp: number; iat: number }>(wsToken);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe("usr-nurse-01");
    expect(verified?.role).toBe("NURSE");
    expect(verified?.scope).toBe("ws:capture");
    expect(verified?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects tokens with invalid signatures or tampered payloads", () => {
    const valid = signSessionToken({ id: "usr-1", role: "NURSE" });
    const tampered = valid.slice(0, -4) + "XXXX";
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("decodes valid session tokens with pseudonymous ID only", () => {
    const payload = Buffer.from(
      JSON.stringify({
        sub: "usr-42",
        role: "NEPHROLOGIST",
      }),
    ).toString("base64url");
    const validToken = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;

    const user = decodeSessionToken(validToken);
    expect(user).not.toBeNull();
    expect(user?.id).toBe("usr-42");
    expect(user?.role).toBe("NEPHROLOGIST");
    expect((user as unknown as Record<string, unknown>).name).toBeUndefined();
    expect((user as unknown as Record<string, unknown>).initials).toBeUndefined();
  });

  it("enforces no personal names in seeded accounts", () => {
    for (const acc of SEEDED_ACCOUNTS) {
      expect((acc as unknown as Record<string, unknown>).name).toBeUndefined();
      expect((acc as unknown as Record<string, unknown>).initials).toBeUndefined();
      expect(acc.identifier).toMatch(/^[a-z]+@dsfav\.local$/);
    }
  });

  it("returns null for malformed tokens", () => {
    expect(decodeSessionToken("invalid-token")).toBeNull();
    expect(decodeSessionToken("")).toBeNull();
  });

  it("rejects tokens with unknown or malformed roles rather than granting clinical access", () => {
    // Malformed token with invalid role
    const invalidRolePayload = Buffer.from(
      JSON.stringify({
        sub: "usr-99",
        role: "INVALID_ROLE",
      }),
    ).toString("base64url");
    const badToken = `eyJhbGciOiJIUzI1NiJ9.${invalidRolePayload}.signature`;

    expect(decodeSessionToken(badToken)).toBeNull();
    expect(verifySessionToken(badToken)).toBeNull();

    // Payload with missing role
    const noRolePayload = Buffer.from(
      JSON.stringify({
        sub: "usr-100",
      }),
    ).toString("base64url");
    const noRoleToken = `eyJhbGciOiJIUzI1NiJ9.${noRolePayload}.signature`;

    expect(decodeSessionToken(noRoleToken)).toBeNull();
    expect(verifySessionToken(noRoleToken)).toBeNull();
  });
});

describe("JWT secret in production [AUTHZ-MATRIX]", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses to sign or accept a session when JWT_SECRET is missing in production", async () => {
    const { signJwt, verifyJwt: verify } = await import("./session");
    // a token forged with the public development default must not be accepted
    const forged = signJwt({ sub: "u-admin-001", role: "ADMIN", exp: 4102444800 }, "change-me");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "");
    expect(() => signJwt({ sub: "x" })).toThrow(/JWT_SECRET/);
    expect(verify(forged)).toBeNull();
  });

  it("keeps the development default outside production", async () => {
    const { signJwt, verifyJwt: verify } = await import("./session");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("JWT_SECRET", "");
    expect(verify(signJwt({ sub: "x" }))).not.toBeNull();
  });
});
