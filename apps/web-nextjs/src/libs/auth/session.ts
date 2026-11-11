import crypto from "node:crypto";
import { isRoleAllowedForRoute } from "../../../../api-nestjs/src/common/authorization";

export type UserRole = "NURSE" | "NEPHROLOGIST" | "INTERN" | "ADMIN";

/**
 * Session user containing only pseudonymous ID and role under the no personal data rule.
 * Hard rule (README rule 2): No personal data anywhere (no name, CIN, birth date, phone, address).
 */
export interface SessionUser {
  id: string;
  role: UserRole;
}

export const SESSION_COOKIE_NAME = "dsfav_session";

export function getRoleHome(role: UserRole): string {
  switch (role) {
    case "NURSE":
      return "/capture";
    case "NEPHROLOGIST":
      return "/dashboard";
    case "INTERN":
      return "/training-bench";
    case "ADMIN":
      return "/devices";
    default:
      return "/login";
  }
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case "NURSE":
      return "Infirmière";
    case "NEPHROLOGIST":
      return "Néphrologue";
    case "INTERN":
      return "Interne";
    case "ADMIN":
      return "Administrateur";
  }
}

export function isRouteAllowedForRole(pathname: string, role: UserRole): boolean {
  if (pathname === "/login") return true;
  return isRoleAllowedForRoute(pathname, role);
}

/**
 * Seeded accounts for development and demo environments.
 * Strictly pseudonymous: no personal names or private identifiers.
 */
export interface SeededAccount {
  identifier: string;
  role: UserRole;
  roleLabel: string;
  description: string;
}

export const SEEDED_ACCOUNTS: SeededAccount[] = [
  {
    identifier: "nurse@dsfav.local",
    role: "NURSE",
    roleLabel: "Infirmière",
    description: "Acquisition au fauteuil",
  },
  {
    identifier: "nephro@dsfav.local",
    role: "NEPHROLOGIST",
    roleLabel: "Néphrologue",
    description: "Tableau de bord, revues & paramètres",
  },
  {
    identifier: "intern@dsfav.local",
    role: "INTERN",
    roleLabel: "Interne",
    description: "Banc d'essai (fantôme uniquement)",
  },
  {
    identifier: "admin@dsfav.local",
    role: "ADMIN",
    roleLabel: "Administrateur",
    description: "Flotte d'appareils & métrologie",
  },
];

const base64UrlEncode = (str: string) =>
  Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const base64UrlDecode = (b64url: string) => {
  const base64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
};

/**
 * The signing secret comes from JWT_SECRET. The public development default only exists outside production:
 * in production a missing secret stops signing and makes verification refuse every token, so a forged cookie
 * signed with the well-known default can never grant a role.
 */
function jwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET must be set in production");
  return "change-me";
}

export function signJwt(
  payload: Record<string, unknown>,
  secret: string = jwtSecret(),
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const headB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headB64}.${payloadB64}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${signature}`;
}

export function verifyJwt<T extends Record<string, unknown>>(
  token: string,
  secretOverride?: string,
): T | null {
  try {
    const secret = secretOverride ?? jwtSecret();
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headB64, payloadB64, signature] = parts;

    const data = `${headB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(data)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    if (signature !== expectedSig) {
      return null;
    }

    const jsonStr = base64UrlDecode(payloadB64);
    const payload = JSON.parse(jsonStr) as T;

    if (payload.exp && typeof payload.exp === "number") {
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec > payload.exp) {
        return null;
      }
    }

    return payload;
  } catch {
    return null;
  }
}

export function signSessionToken(user: SessionUser): string {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    sub: user.id,
    role: user.role,
    iat: now,
    exp: now + 8 * 3600, // 8 hours
  });
}

export function signWsToken(user: SessionUser): string {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    sub: user.id,
    role: user.role,
    scope: "ws:capture",
    iat: now,
    exp: now + 60, // 60 seconds
  });
}

export const VALID_ROLES = new Set<UserRole>(["NURSE", "NEPHROLOGIST", "INTERN", "ADMIN"]);

export function isValidRole(role: unknown): role is UserRole {
  return typeof role === "string" && VALID_ROLES.has(role as UserRole);
}

export function verifySessionToken(token: string): SessionUser | null {
  const payload = verifyJwt<{ sub?: string; id?: string; role?: unknown }>(token);
  if (!payload || !isValidRole(payload.role)) return null;
  return {
    id: payload.sub ?? payload.id ?? "usr-unknown",
    role: payload.role,
  };
}

export function decodeSessionToken(token: string): SessionUser | null {
  const verified = verifySessionToken(token);
  if (verified) return verified;

  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const jsonStr = base64UrlDecode(parts[1]);
    const parsed = JSON.parse(jsonStr);
    if (!parsed || !isValidRole(parsed.role)) return null;
    return {
      id: parsed.sub ?? parsed.id ?? "usr-unknown",
      role: parsed.role,
    };
  } catch {
    return null;
  }
}
