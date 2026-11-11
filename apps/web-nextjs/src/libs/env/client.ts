// NEXT_PUBLIC_* values are inlined at build time, so reference them literally.
export const clientEnv = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3101",
} as const;
