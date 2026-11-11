// Prisma 7 reads the datasource URL from here (schema files no longer accept `url`).
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, env } from 'prisma/config';

const dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(dir, '.env');
if (!process.env.DATABASE_URL && existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch {}
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'node prisma/seed.ts',
  },
  datasource: { url: env('DATABASE_URL') },
});
