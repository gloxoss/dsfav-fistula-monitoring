import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import bcrypt from 'bcryptjs';

const dir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(dir, '..');

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function main() {
  console.log('[SEED] Starting DSFAV database seed...');

  // 1. Password hash for demo users (demo1234, dev only)
  const passwordHash = bcrypt.hashSync('demo1234', 10);

  // 2. Device tokens
  const devTokens: Record<string, string> = {
    'DSFAV-UNIT-01': 'dev-token-unit-01',
    'DSFAV-UNIT-02': 'dev-token-unit-02',
    'DSFAV-UNIT-03': 'dev-token-unit-03',
    'DSFAV-UNIT-04': 'dev-token-unit-04',
  };

  if (process.env.DEVICE_TOKENS) {
    try {
      const parsed = JSON.parse(process.env.DEVICE_TOKENS);
      Object.assign(devTokens, parsed);
    } catch {
      const parts = process.env.DEVICE_TOKENS.split(',');
      for (const p of parts) {
        const [k, v] = p.split(':');
        if (k && v) devTokens[k.trim()] = v.trim();
      }
    }
  }

  const tokenHash1 = hashToken(devTokens['DSFAV-UNIT-01']);
  const tokenHash2 = hashToken(devTokens['DSFAV-UNIT-02']);
  const tokenHash3 = hashToken(devTokens['DSFAV-UNIT-03']);
  const tokenHash4 = hashToken(devTokens['DSFAV-UNIT-04']);

  const sql = `
    -- 1. Users (nurse, nephro, intern, admin)
    INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt")
    VALUES
      ('u-nurse-001', 'nurse@dsfav.local', '${passwordHash}', 'NURSE', NOW()),
      ('u-nephro-001', 'nephro@dsfav.local', '${passwordHash}', 'NEPHROLOGIST', NOW()),
      ('u-intern-001', 'intern@dsfav.local', '${passwordHash}', 'INTERN', NOW()),
      ('u-admin-001', 'admin@dsfav.local', '${passwordHash}', 'ADMIN', NOW())
    ON CONFLICT ("email") DO UPDATE SET "role" = EXCLUDED."role", "passwordHash" = EXCLUDED."passwordHash";

    -- 2. Patients: PT-CAS-8841 (ACTIVE baseline), PT-CAS-4471 (BUILDING 2/3), PT-CAS-9277 absent
    INSERT INTO "PatientPseudo" ("id", "idPseudo", "fistulaType", "armSide", "baselineVector", "baselineLocked", "createdAt")
    VALUES
      ('p-8841-001', 'PT-CAS-8841', 'RADIO_CEPHALIC', 'LEFT', '{"rms_mean":0.145,"rms_std":0.012,"stenosis_ratio_mean":0.32,"stenosis_ratio_std":0.025,"fpeak_mean":68.0,"fpeak_std":4.5,"threshold_sigma":3.4}'::jsonb, true, NOW()),
      ('p-4471-001', 'PT-CAS-4471', 'BRACHIO_CEPHALIC', 'RIGHT', NULL, false, NOW())
    ON CONFLICT ("idPseudo") DO UPDATE SET
      "fistulaType" = EXCLUDED."fistulaType",
      "armSide" = EXCLUDED."armSide",
      "baselineVector" = EXCLUDED."baselineVector",
      "baselineLocked" = EXCLUDED."baselineLocked";

    -- Active baseline version for PT-CAS-8841
    INSERT INTO "BaselineVersion" ("id", "patientId", "rmsMean", "rmsStd", "ratioMean", "ratioStd", "fpeakMean", "fpeakStd", "lockedAt", "lockedById", "reason", "active", "createdAt")
    VALUES ('bv-8841-001', 'p-8841-001', 0.145, 0.012, 0.32, 0.025, 68.0, 4.5, NOW(), 'u-nephro-001', 'Baseline de référence (3 sessions conformes)', true, NOW())
    ON CONFLICT ("id") DO UPDATE SET "active" = true;

    -- Ensure PT-CAS-9277 is absent for registration tests (UC5)
    DELETE FROM "PatientPseudo" WHERE "idPseudo" = 'PT-CAS-9277';

    -- 3. Devices DSFAV-UNIT-01..04 (UNIT-04 battery 12, gain +3.9%)
    INSERT INTO "Device" ("id", "serialNumber", "macAddress", "deviceTokenHash", "calibrationOffsetRms", "calibrationGain", "lastBatteryPct", "lastSeenAt", "createdAt")
    VALUES
      ('dev-01-001', 'DSFAV-UNIT-01', 'AA:BB:CC:DD:EE:01', '${tokenHash1}', 0.0, 1.0, 95, NOW(), NOW()),
      ('dev-02-001', 'DSFAV-UNIT-02', 'AA:BB:CC:DD:EE:02', '${tokenHash2}', 0.0, 1.0, 78, NOW(), NOW()),
      ('dev-03-001', 'DSFAV-UNIT-03', 'AA:BB:CC:DD:EE:03', '${tokenHash3}', 0.0, 1.0, 54, NOW(), NOW()),
      ('dev-04-001', 'DSFAV-UNIT-04', 'AA:BB:CC:DD:EE:04', '${tokenHash4}', 0.0, 1.039, 12, NOW(), NOW())
    ON CONFLICT ("serialNumber") DO UPDATE SET
      "macAddress" = EXCLUDED."macAddress",
      "deviceTokenHash" = EXCLUDED."deviceTokenHash",
      "calibrationGain" = EXCLUDED."calibrationGain",
      "lastBatteryPct" = EXCLUDED."lastBatteryPct";

    -- 4. ConfigVersion v7 ACTIVE with canonical defaults
    INSERT INTO "ConfigVersion" ("id", "version", "status", "values", "authorId", "reviewerId", "reason", "publishedAt", "createdAt")
    VALUES ('cfg-v7-001', 7, 'ACTIVE', '{"thresholdSigma":3.4,"consecutiveAlerts":2,"pressureMinKpa":2.5,"pressureLowKpa":3.0,"pressureHighKpa":8.5,"pressureMaxKpa":9.0,"motionThresholdG":0.08,"cleanTimeMinSec":12.0,"stdFloorPct":5.0}'::jsonb, 'u-admin-001', 'u-nephro-001', 'Canonical clinical thresholds per the canonical specification', NOW(), NOW())
    ON CONFLICT ("version") DO UPDATE SET
      "status" = EXCLUDED."status",
      "values" = EXCLUDED."values",
      "reason" = EXCLUDED."reason",
      "publishedAt" = EXCLUDED."publishedAt";
  `;

  execSync('npx prisma db execute --stdin', {
    input: sql,
    cwd: apiDir,
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  console.log('[SEED] Seed completed successfully.');
}

main().catch((e) => {
  console.error('[SEED] Error during seeding:', e);
  process.exit(1);
});
