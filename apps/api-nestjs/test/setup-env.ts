// Jest global setup: the API reads DATABASE_URL from the environment when PrismaClient
// is constructed, so every suite runs against the same seeded Postgres (never a fake).
//
// process.loadEnvFile() is not enough here: Jest's sandbox process.env is a copy, so
// values loaded by the real Node function do not reach the code under test. Parse the
// file ourselves and only fill variables the caller did not already export.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = resolve(apiRoot, '.env');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

if (typeof jest !== 'undefined') {
  jest.setTimeout(30000);
}
