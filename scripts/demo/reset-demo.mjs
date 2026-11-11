import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');

export const ALLOWED_TABLES = [
  'Measurement',
  'SyncQueueItem',
  'BenchSession',
  'ClinicalNote',
  'FollowUpIntent',
  'AuditEvent',
  'BaselineVersion',
  'PatientPseudo',
];

export const FORBIDDEN_TABLES = [
  'User',
  'Device',
  'ConfigVersion',
];

export function readDatabaseUrl(envPath) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
      if (match) {
        return match[1].trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
  return process.env.DATABASE_URL || '';
}

export function validateEnvironment({ databaseUrl, hasYes }) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined in environment or apps/api-nestjs/.env');
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch (err) {
    throw new Error(`Invalid DATABASE_URL format: ${err.message}`);
  }

  const hostname = parsed.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

  if (!isLocal) {
    throw new Error(`Refusing to run on non-local database host: ${hostname}. Only localhost and 127.0.0.1 are permitted.`);
  }

  if (!hasYes) {
    throw new Error('Refusing to run without --yes flag. Use --yes to confirm deletion of demo data.');
  }

  return { isLocal, hasYes, host: hostname, port: parsed.port, pathname: parsed.pathname };
}

export function buildResetQueries({ demoPatientPseudos, demoPatientIds }) {
  const pseudosList = demoPatientPseudos.map((p) => `'${p}'`).join(', ');
  const idsList = demoPatientIds.map((id) => `'${id}'`).join(', ');

  const queries = [
    // 0. Bench (phantom) sessions left by training runs, tests and the virtual study: they belong to no patient.
    `DELETE FROM "BenchSession" WHERE "measurementId" IN (SELECT id FROM "Measurement" WHERE "source" = 'BENCH' AND "patientId" IS NULL)`,
    `DELETE FROM "Measurement" WHERE "source" = 'BENCH' AND "patientId" IS NULL`,

    // 1. BenchSession rows referencing demo measurements
    `DELETE FROM "BenchSession" WHERE "measurementId" IN (SELECT id FROM "Measurement" WHERE "patientId" IN (${idsList}))`,

    // 2. FollowUpIntent rows referencing demo patients or measurements
    `DELETE FROM "FollowUpIntent" WHERE "patientId" IN (${idsList}) OR "measurementId" IN (SELECT id FROM "Measurement" WHERE "patientId" IN (${idsList}))`,

    // 3. ClinicalNote rows referencing demo patients or measurements
    `DELETE FROM "ClinicalNote" WHERE "patientId" IN (${idsList}) OR "measurementId" IN (SELECT id FROM "Measurement" WHERE "patientId" IN (${idsList}))`,

    // 4. AuditEvent rows referencing demo patients, measurements, clinical notes, follow-up intents
    `DELETE FROM "AuditEvent" WHERE ("entity" = 'PatientPseudo' AND "entityId" IN (${idsList}, ${pseudosList})) OR ("entity" = 'Measurement' AND "entityId" IN (SELECT id FROM "Measurement" WHERE "patientId" IN (${idsList}))) OR ("entity" = 'ClinicalNote' AND "entityId" IN (SELECT id FROM "ClinicalNote" WHERE "patientId" IN (${idsList}))) OR ("entity" = 'FollowUpIntent' AND "entityId" IN (SELECT id FROM "FollowUpIntent" WHERE "patientId" IN (${idsList})))`,

    // 5. Measurement rows for demo patients
    `DELETE FROM "Measurement" WHERE "patientId" IN (${idsList})`,

    // 6. SyncQueueItem rows for demo patients
    `DELETE FROM "SyncQueueItem" WHERE payload->>'patient' IN (${pseudosList}) OR payload->>'patientId' IN (${idsList})`,

    // 7. BaselineVersion rows (keep canonical seed version bv-8841-001)
    `DELETE FROM "BaselineVersion" WHERE "patientId" IN (${idsList}) AND "id" != 'bv-8841-001'`,

    // 8. Restore canonical seed state for demo patients
    `INSERT INTO "PatientPseudo" ("id", "idPseudo", "fistulaType", "armSide", "baselineVector", "baselineLocked", "createdAt") VALUES ('p-8841-001', 'PT-CAS-8841', 'RADIO_CEPHALIC', 'LEFT', '{"rms_mean":0.145,"rms_std":0.012,"stenosis_ratio_mean":0.32,"stenosis_ratio_std":0.025,"fpeak_mean":68.0,"fpeak_std":4.5,"threshold_sigma":3.4}'::jsonb, true, NOW()), ('p-4471-001', 'PT-CAS-4471', 'BRACHIO_CEPHALIC', 'RIGHT', NULL, false, NOW()) ON CONFLICT ("idPseudo") DO UPDATE SET "fistulaType" = EXCLUDED."fistulaType", "armSide" = EXCLUDED."armSide", "baselineVector" = EXCLUDED."baselineVector", "baselineLocked" = EXCLUDED."baselineLocked"`,

    // 9. Restore canonical baseline version for PT-CAS-8841
    `INSERT INTO "BaselineVersion" ("id", "patientId", "rmsMean", "rmsStd", "ratioMean", "ratioStd", "fpeakMean", "fpeakStd", "lockedAt", "lockedById", "reason", "active", "createdAt") VALUES ('bv-8841-001', 'p-8841-001', 0.145, 0.012, 0.32, 0.025, 68.0, 4.5, NOW(), 'u-nephro-001', 'Baseline de référence (3 sessions conformes)', true, NOW()) ON CONFLICT ("id") DO UPDATE SET "active" = true, "rmsMean" = 0.145, "rmsStd" = 0.012, "ratioMean" = 0.32, "ratioStd" = 0.025, "fpeakMean" = 68.0, "fpeakStd" = 4.5`,

    // 10. Clean up registration test patient PT-CAS-9277 if present
    `DELETE FROM "PatientPseudo" WHERE "idPseudo" = 'PT-CAS-9277'`,
  ];

  return queries;
}

export async function runResetDemo(options = {}) {
  const envPath = options.envPath || resolve(REPO_ROOT, 'apps/api-nestjs/.env');
  const databaseUrl = options.databaseUrl || readDatabaseUrl(envPath);
  const hasYes = options.hasYes ?? process.argv.includes('--yes');
  const andSeed = options.andSeed ?? process.argv.includes('--seed');

  validateEnvironment({ databaseUrl, hasYes });

  const require = createRequire(import.meta.url);
  const apiDir = resolve(REPO_ROOT, 'apps/api-nestjs');
  const { Client } = require(resolve(apiDir, 'node_modules/pg'));

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const demoPatientPseudos = ['PT-CAS-8841', 'PT-CAS-4471'];

    const patientsRes = await client.query(
      `SELECT id, "idPseudo" FROM "PatientPseudo" WHERE "idPseudo" = ANY($1::text[])`,
      [demoPatientPseudos]
    );

    const demoPatientIds = patientsRes.rows.map((r) => r.id);
    if (!demoPatientIds.includes('p-8841-001')) demoPatientIds.push('p-8841-001');
    if (!demoPatientIds.includes('p-4471-001')) demoPatientIds.push('p-4471-001');

    console.log(`[RESET-DEMO] Target database: ${databaseUrl.replace(/:[^:@]+@/, ':***@')}`);
    console.log(`[RESET-DEMO] Demo patients: ${demoPatientPseudos.join(', ')}`);

    // Count rows before deletion
    const idsList = demoPatientIds.map((id) => `'${id}'`).join(', ');
    const pseudosList = demoPatientPseudos.map((p) => `'${p}'`).join(', ');

    const countQueries = {
      Measurement: `SELECT count(*) FROM "Measurement" WHERE "patientId" IN (${idsList})`,
      SyncQueueItem: `SELECT count(*) FROM "SyncQueueItem" WHERE payload->>'patient' IN (${pseudosList}) OR payload->>'patientId' IN (${idsList})`,
      BenchSession: `SELECT count(*) FROM "BenchSession" WHERE "measurementId" IN (SELECT id FROM "Measurement" WHERE "patientId" IN (${idsList}))`,
      ClinicalNote: `SELECT count(*) FROM "ClinicalNote" WHERE "patientId" IN (${idsList}) OR "measurementId" IN (SELECT id FROM "Measurement" WHERE "patientId" IN (${idsList}))`,
      FollowUpIntent: `SELECT count(*) FROM "FollowUpIntent" WHERE "patientId" IN (${idsList}) OR "measurementId" IN (SELECT id FROM "Measurement" WHERE "patientId" IN (${idsList}))`,
      AuditEvent: `SELECT count(*) FROM "AuditEvent" WHERE ("entity" = 'PatientPseudo' AND "entityId" IN (${idsList}, ${pseudosList})) OR ("entity" = 'Measurement' AND "entityId" IN (SELECT id FROM "Measurement" WHERE "patientId" IN (${idsList}))) OR ("entity" = 'ClinicalNote' AND "entityId" IN (SELECT id FROM "ClinicalNote" WHERE "patientId" IN (${idsList}))) OR ("entity" = 'FollowUpIntent' AND "entityId" IN (SELECT id FROM "FollowUpIntent" WHERE "patientId" IN (${idsList})))`,
    };

    console.log('[RESET-DEMO] Querying rows to delete...');
    const counts = {};
    for (const [table, q] of Object.entries(countQueries)) {
      const res = await client.query(q);
      counts[table] = parseInt(res.rows[0].count, 10);
      console.log(`  - ${table}: ${counts[table]} rows`);
    }

    const resetQueries = buildResetQueries({ demoPatientPseudos, demoPatientIds });

    console.log('[RESET-DEMO] Executing reset in ONE transaction...');
    await client.query('BEGIN');
    for (const query of resetQueries) {
      await client.query(query);
    }
    await client.query('COMMIT');

    console.log('[RESET-DEMO] Reset transaction committed successfully.');
    if (options.clearAudit ?? process.argv.includes('--clear-audit')) {
      // Local development database only (host already validated): removes test noise such as hundreds of calibration events.
      const cleared = await client.query('DELETE FROM "AuditEvent"');
      console.log(`[RESET-DEMO] --clear-audit: ${cleared.rowCount} audit events removed (development database).`);
    }
    console.log('[RESET-DEMO] Demo patients baseline state restored per canonical seed.');

    if (andSeed) {
      console.log('[RESET-DEMO] --seed requested: executing seed-demo-sessions.mjs...');
      const seedScript = resolve(__dirname, 'seed-demo-sessions.mjs');
      const res = spawnSync(process.execPath, [seedScript], {
        stdio: 'inherit',
        cwd: REPO_ROOT,
        env: { ...process.env },
      });
      if (res.status !== 0) {
        throw new Error(`seed-demo-sessions failed with exit code ${res.status}`);
      }
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw err;
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (isMain) {
  runResetDemo().catch((err) => {
    console.error(`[RESET-DEMO ERROR] ${err.message}`);
    process.exit(1);
  });
}
