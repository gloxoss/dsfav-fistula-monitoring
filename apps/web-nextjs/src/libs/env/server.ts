import "server-only";

// Read lazily so importing this module never throws during build when the variable is absent.
export function getServerEnv() {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    throw new Error("API_URL is not set");
  }
  return { API_URL: apiUrl } as const;
}
