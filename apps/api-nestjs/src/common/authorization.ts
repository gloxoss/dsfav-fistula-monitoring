export type AuthorizationRole = 'NURSE' | 'NEPHROLOGIST' | 'INTERN' | 'ADMIN';

export const ROLE_ROUTE_POLICY: Readonly<Record<string, readonly AuthorizationRole[]>> = {
  '/capture': ['NURSE'],
  '/dashboard': ['NURSE', 'NEPHROLOGIST'],
  '/patients': ['NURSE', 'NEPHROLOGIST'],
  '/notes': ['NEPHROLOGIST'],
  '/training-bench': ['INTERN'],
  '/bench-history': ['NEPHROLOGIST', 'INTERN'],
  '/devices': ['NURSE', 'NEPHROLOGIST', 'ADMIN'],
  '/settings/clinical': ['NEPHROLOGIST', 'ADMIN'],
  '/baseline-history': ['NEPHROLOGIST'],
  '/admin/audit': ['NEPHROLOGIST', 'ADMIN'],
  '/admin/users': ['ADMIN'],
};

const API_ROUTE_POLICY: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/audit(?:\/|$)/, '/admin/audit'],
  [/^\/users(?:\/|$)/, '/admin/users'],
  [/^\/patients(?:\/|$)/, '/patients'],
  [/^\/notes(?:\/|$)/, '/notes'],
  [/^\/baseline(?:\/|$)/, '/baseline-history'],
  [/^\/devices(?:\/|$)/, '/devices'],
  [/^\/config(?:\/|$)/, '/settings/clinical'],
];

export function isRoleAllowedForRoute(route: string, role: AuthorizationRole): boolean {
  const base = Object.keys(ROLE_ROUTE_POLICY)
    .sort((left, right) => right.length - left.length)
    .find((candidate) => route === candidate || route.startsWith(`${candidate}/`));
  return base ? ROLE_ROUTE_POLICY[base].includes(role) : false;
}

export function isRoleAllowedForApiPath(path: string, role: AuthorizationRole, method = 'GET'): boolean | null {
  const normalizedPath = path.replace(/^\/api\/v\d+/, '');
  const normalizedMethod = method.toUpperCase();

  if (/^\/patients\/[^/]+\/(?:notes|follow-ups|follow-up-intents|rebaseline)(?:\/|$)/.test(normalizedPath)) {
    return role === 'NEPHROLOGIST';
  }
  if (/^\/patients\/[^/]+\/baseline-versions(?:\/|$)/.test(normalizedPath)) {
    return role === 'NEPHROLOGIST';
  }
  if (/^\/devices\/[^/]+\/calibration(?:\/|$)/.test(normalizedPath)) {
    return role === 'ADMIN';
  }
  if (/^\/config\/versions\/[^/]+\/publish(?:\/|$)/.test(normalizedPath)) {
    return role === 'NEPHROLOGIST';
  }
  if (/^\/config\/versions(?:\/|$)/.test(normalizedPath) && normalizedMethod === 'POST') {
    return role === 'NEPHROLOGIST' || role === 'ADMIN';
  }
  if (normalizedPath === '/config/active') return true;
  if (/^\/bench(?:\/|$)/.test(normalizedPath)) {
    return isRoleAllowedForRoute(normalizedMethod === 'GET' ? '/bench-history' : '/training-bench', role);
  }
  // Measurement creation accepts both patient captures and bench captures;
  // controller roles remain the final check because the source is in the body.
  if (/^\/measurements(?:\/|$)/.test(normalizedPath)) return null;

  const route = API_ROUTE_POLICY.find(([pattern]) => pattern.test(normalizedPath))?.[1];
  return route ? isRoleAllowedForRoute(route, role) : null;
}
