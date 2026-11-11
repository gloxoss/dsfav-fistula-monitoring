import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readDatabaseUrl } from './reset-demo.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');

const API_URL = process.env.API_URL || 'http://localhost:3101';
const PASSWORD = 'demo1234';
const DEVICE_TOKENS =
  process.env.DEVICE_TOKENS ||
  'DSFAV-UNIT-01=dev-token-unit-01,DSFAV-UNIT-02=dev-token-unit-02,DSFAV-UNIT-03=dev-token-unit-03,DSFAV-UNIT-04=dev-token-unit-04';

function runSimulatorCapture({ scenario, patient, device = 'DSFAV-UNIT-01', speed = 50, user = 'nurse' }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const simulatorDir = resolve(REPO_ROOT, 'scripts/simulator');
    const args = [
      'run',
      '--project',
      simulatorDir,
      '--no-sync',
      'dsfav-sim',
      '--device',
      device,
      '--scenario',
      scenario,
      '--api',
      API_URL,
      '--speed',
      String(speed),
      '--headless-capture',
      '--patient',
      patient,
      '--user',
      user,
      '--password',
      PASSWORD,
    ];

    const child = spawn('uv', args, {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        DEVICE_TOKENS,
      },
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });

    child.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code !== 0) {
        return rejectPromise(
          new Error(`Simulator failed (exit ${code}) for scenario ${scenario}:\n${stderr}\n${stdout}`)
        );
      }

      let measurementId = null;
      let rawResult = null;

      for (const line of stdout.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.measurementId) measurementId = parsed.measurementId;
          if (parsed.status_code !== undefined || parsed.status !== undefined) {
            rawResult = parsed;
          }
        } catch {}
      }

      if (!measurementId) {
        return rejectPromise(
          new Error(`Simulator finished for ${scenario} but no measurementId was found in output:\n${stdout}`)
        );
      }

      resolvePromise({ measurementId, rawResult });
    });
  });
}

export async function seedDemoSessions() {
  console.log(`[SEED-DEMO] Seeding realistic sessions via API ${API_URL}...`);

  // Connect to DB for direct backdating of recordedAt
  const require = createRequire(import.meta.url);
  const apiDir = resolve(REPO_ROOT, 'apps/api-nestjs');
  const { Client } = require(resolve(apiDir, 'node_modules/pg'));
  const databaseUrl = readDatabaseUrl(resolve(apiDir, '.env'));
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    // The dashboard shows the queue of TODAY: the most recent demo sessions are dated today at morning hours (never in the future).
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const today = (hour, minute = 0) => new Date(Math.min(startOfToday.getTime() + (hour * 60 + minute) * 60 * 1000, now - 60 * 1000));

    // Plan for PT-CAS-8841:
    // 8 valid sessions spread over 6 weeks with progressive rise:
    // healthy -> healthy -> healthy -> mild -> mild -> moderate -> moderate -> moderate
    // 2 rejected sessions: motion_heavy and low_pressure
    const pt8841Sessions = [
      {
        scenario: 'healthy',
        date: new Date(now - 42 * DAY),
        note: '[Données synthétiques] Contrôle de routine S-6. FAV radio-céphalique gauche fonctionnelle, thrill souple et régulier.',
      },
      {
        scenario: 'healthy',
        date: new Date(now - 35 * DAY),
        note: '[Données synthétiques] Contrôle de routine S-5. Signal stable conforme à la référence initiale.',
      },
      {
        scenario: 'healthy',
        date: new Date(now - 28 * DAY),
        note: '[Données synthétiques] Contrôle de routine S-4. Paramètres hémodynamiques et spectraux stables.',
      },
      {
        scenario: 'mild',
        date: new Date(now - 21 * DAY),
        note: '[Données synthétiques] Contrôle S-3. Légère élévation de l\'énergie haute fréquence détectée. Surveillance accrue.',
      },
      {
        scenario: 'mild',
        date: new Date(now - 14 * DAY),
        note: '[Données synthétiques] Contrôle S-2. Déviation modérée confirmée. Examen clinique attentif recommandé.',
      },
      {
        scenario: 'motion_heavy',
        date: new Date(now - 10 * DAY),
        note: '[Données synthétiques] Mesure rejetée (REJECTED_QUALITY). Mouvements importants du bras (durée propre < 12 s).',
        isRejected: true,
      },
      {
        scenario: 'moderate',
        date: new Date(now - 7 * DAY),
        note: '[Données synthétiques] Contrôle S-1. Statut TO_CONFIRM. Accroissement net du ratio hautes/basses fréquences.',
      },
      {
        scenario: 'low_pressure',
        date: today(7, 40),
        note: '[Données synthétiques] Mesure rejetée (REJECTED_QUALITY). Pression d\'appui insuffisante (< 2.5 kPa). Repositionnement demandé.',
        isRejected: true,
      },
      {
        scenario: 'moderate',
        date: today(8, 20),
        note: '[Données synthétiques] Statut UNUSUAL_EVOLUTION. Deuxième alerte consécutive au-dessus du seuil.',
        createFollowUp: true,
      },
      {
        scenario: 'moderate',
        date: today(9, 10),
        note: '[Données synthétiques] Session récente. Confirmation de l\'évolution inhabituelle. Programmation d\'un écho-Doppler.',
      },
    ];

    console.log('[SEED-DEMO] Creating 10 sessions for PT-CAS-8841...');
    for (const [index, s] of pt8841Sessions.entries()) {
      process.stdout.write(`  [${index + 1}/10] Scenario: ${s.scenario} for PT-CAS-8841... `);
      const { measurementId, rawResult } = await runSimulatorCapture({
        scenario: s.scenario,
        patient: 'PT-CAS-8841',
      });

      // Backdate recordedAt and createdAt in PostgreSQL
      await client.query(
        `UPDATE "Measurement" SET "recordedAt" = $1, "createdAt" = $1 WHERE "id" = $2`,
        [s.date, measurementId]
      );

      // Insert clinical note labelled synthetic
      const noteId = `cn-demo-8841-${index + 1}`;
      await client.query(
        `INSERT INTO "ClinicalNote" ("id", "patientId", "measurementId", "authorId", "text", "createdAt")
         VALUES ($1, 'p-8841-001', $2, 'u-nephro-001', $3, $4)
         ON CONFLICT ("id") DO NOTHING`,
        [noteId, measurementId, s.note, s.date]
      );

      // Follow-up intent if flagged
      if (s.createFollowUp) {
        const intentId = `fui-demo-8841-1`;
        await client.query(
          `INSERT INTO "FollowUpIntent" ("id", "patientId", "measurementId", "authorId", "reason", "createdAt")
           VALUES ($1, 'p-8841-001', $2, 'u-nephro-001', $3, $4)
           ON CONFLICT ("id") DO NOTHING`,
          [
            intentId,
            measurementId,
            '[Données synthétiques] Demande d\'examen écho-Doppler de contrôle suite à alertes consécutives.',
            s.date,
          ]
        );
      }

      const status = rawResult?.status || rawResult?.quality_gate?.passed ? 'VALID' : 'REJECTED';
      console.log(`done (id: ${measurementId}, date: ${s.date.toISOString().slice(0, 10)})`);
    }

    // Plan for PT-CAS-4471:
    // 2 valid sessions (baseline building 2 of 3)
    const pt4471Sessions = [
      {
        scenario: 'healthy',
        date: new Date(now - 7 * DAY),
        note: '[Données synthétiques] Session 1/3 pour construction de la baseline (FAV brachio-céphalique droite).',
      },
      {
        scenario: 'healthy',
        date: today(8, 50),
        note: '[Données synthétiques] Session 2/3 pour construction de la baseline. Encore 1 session requise avant verrouillage.',
      },
    ];

    console.log('[SEED-DEMO] Creating 2 valid sessions for PT-CAS-4471 (building 2 of 3)...');
    for (const [index, s] of pt4471Sessions.entries()) {
      process.stdout.write(`  [${index + 1}/2] Scenario: ${s.scenario} for PT-CAS-4471... `);
      const { measurementId } = await runSimulatorCapture({
        scenario: s.scenario,
        patient: 'PT-CAS-4471',
      });

      await client.query(
        `UPDATE "Measurement" SET "recordedAt" = $1, "createdAt" = $1 WHERE "id" = $2`,
        [s.date, measurementId]
      );

      const noteId = `cn-demo-4471-${index + 1}`;
      await client.query(
        `INSERT INTO "ClinicalNote" ("id", "patientId", "measurementId", "authorId", "text", "createdAt")
         VALUES ($1, 'p-4471-001', $2, 'u-nephro-001', $3, $4)
         ON CONFLICT ("id") DO NOTHING`,
        [noteId, measurementId, s.note, s.date]
      );

      console.log(`done (id: ${measurementId}, date: ${s.date.toISOString().slice(0, 10)})`);
    }

    // Verify baselineBuilding status on PT-CAS-4471
    await client.query(
      `UPDATE "PatientPseudo" SET "baselineLocked" = false, "baselineVector" = NULL WHERE "id" = 'p-4471-001'`
    );

    console.log('[SEED-DEMO] Seeding completed successfully!');
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (isMain) {
  seedDemoSessions().catch((err) => {
    console.error(`[SEED-DEMO ERROR] ${err.message}`);
    process.exit(1);
  });
}
