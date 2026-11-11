const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveBenchDeviceId(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return UUID_PATTERN.test(value) ? value : null;
}
