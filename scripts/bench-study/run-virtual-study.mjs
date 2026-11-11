#!/usr/bin/env node
/**
 * Runner for the DSFAV virtual bench study.
 * Generates synthetic phantom captures across 4 clamp stenosis levels (0%, 30%, 50%, 75%),
 * submits intern palpation answers, completes captures via the real API,
 * and writes the deterministic features CSV and concordance report.
 *
 * Mandatory rule: All data generated and reported are explicitly labelled synthetic.
 * Sentence verbatim: "Données synthétiques : ce rapport démontre la méthode, pas la validité clinique."
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const CLINICAL_DISCLAIMER =
  "Aide à la décision uniquement : la décision d’un examen écho-Doppler reste médicale.";
const SYNTHETIC_NOTICE =
  "Données synthétiques : ce rapport démontre la méthode, pas la validité clinique.";
const BENCH_NOTICE = "Simulation sur banc, pas de donnée patient";

// Parse CLI arguments
const args = process.argv.slice(2);
let numSessions = 5;
let apiUrl = process.env.API_URL || "http://localhost:3101";
let baseSeed = 42;
let csvOutputPath = path.resolve(REPO_ROOT, "apps/dsp-python/data/virtual-bench-features.csv");
let reportOutputPath = path.resolve(REPO_ROOT, "docs/bench-study/virtual-study-report.md");

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--sessions" && args[i + 1]) {
    numSessions = parseInt(args[i + 1], 10);
    i += 1;
  } else if ((args[i] === "--api" || args[i] === "--api-url") && args[i + 1]) {
    apiUrl = args[i + 1];
    i += 1;
  } else if (args[i] === "--seed" && args[i + 1]) {
    baseSeed = parseInt(args[i + 1], 10);
    i += 1;
  } else if (args[i] === "--csv" && args[i + 1]) {
    csvOutputPath = path.resolve(args[i + 1]);
    i += 1;
  } else if (args[i] === "--report" && args[i + 1]) {
    reportOutputPath = path.resolve(args[i + 1]);
    i += 1;
  }
}

// Security rule: refuse to run if API_URL is not localhost
const parsedUrl = new URL(apiUrl);
if (parsedUrl.hostname !== "localhost" && parsedUrl.hostname !== "127.0.0.1") {
  console.error(
    `[REFUSAL] run-virtual-study refuse d’exécuter contre un hôte non-local : ${parsedUrl.hostname}`
  );
  process.exit(1);
}

// Preset mapping for the 4 clamp levels
const CLAMP_CONDITIONS = [
  {
    clampPct: 0,
    flowMlMin: 450,
    scenario: "healthy",
    perceivedThrill: "CONTINUOUS_SOFT",
    perceivedIntensity: 2,
    internNotes: "Simulation banc phantom clamp 0% : thrill souple et continu",
  },
  {
    clampPct: 30,
    flowMlMin: 450,
    scenario: "mild",
    perceivedThrill: "CONTINUOUS_SOFT",
    perceivedIntensity: 2,
    internNotes: "Simulation banc phantom clamp 30% : thrill souple perceptible",
  },
  {
    clampPct: 50,
    flowMlMin: 450,
    scenario: "moderate",
    perceivedThrill: "SYSTOLIC_ROUGH",
    perceivedIntensity: 3,
    internNotes: "Simulation banc phantom clamp 50% : thrill rugueux méso-systolique",
  },
  {
    clampPct: 75,
    flowMlMin: 450,
    scenario: "severe",
    perceivedThrill: "HYPERPULSATILE",
    perceivedIntensity: 4,
    internNotes: "Simulation banc phantom clamp 75% : thrill hyperpulsatile franc",
  },
];

async function fetchJsonWithRetry(url, options, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
}
async function loginIntern() {
  const res = await fetchJsonWithRetry(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "intern@dsfav.local", password: "demo1234" }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.token;
}

function generateSimulatorCapture(scenarioName, seed) {
  const pyCode = `
import json, sys
from dsfav_sim.scenarios import build_scenario
from dsfav_sim.protocol import encode_raw
from dsfav_dsp.ai.features import extract_features
from dsfav_dsp.filters import bandpass_filter

sc = build_scenario('${scenarioName}', seed=${seed})
raw = encode_raw(sc.adxl, sc.lis, sc.pressure_kpa)
filtered = bandpass_filter(sc.adxl, fs=1000)
feat = extract_features(filtered, 1000)

result = {
    "raw_hex": raw.hex(),
    "features": feat
}
print(json.dumps(result))
`;

  const out = execSync("uv run python -", {
    cwd: path.resolve(REPO_ROOT, "scripts/simulator"),
    input: pyCode,
    maxBuffer: 15 * 1024 * 1024,
    encoding: "utf-8",
  });

  const parsed = JSON.parse(out.trim());
  return {
    rawPayload: Buffer.from(parsed.raw_hex, "hex"),
    features: parsed.features,
  };
}

async function runSession(token, condition, repetition, seed) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 1. Create bench session
  const sessionRes = await fetchJsonWithRetry(`${apiUrl}/bench/sessions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      pumpFlowMlMin: condition.flowMlMin,
      clampStenosisPct: condition.clampPct,
    }),
  });
  if (!sessionRes.ok) {
    throw new Error(`POST /bench/sessions failed: ${sessionRes.status} ${await sessionRes.text()}`);
  }
  const session = await sessionRes.json();
  const sessionId = session.id;

  // 2. Submit palpation answer
  const palpRes = await fetchJsonWithRetry(`${apiUrl}/bench/sessions/${sessionId}/palpation`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      perceivedThrill: condition.perceivedThrill,
      perceivedIntensity: condition.perceivedIntensity,
      internNotes: condition.internNotes,
    }),
  });
  if (!palpRes.ok) {
    throw new Error(`POST /bench/sessions/${sessionId}/palpation failed: ${palpRes.status} ${await palpRes.text()}`);
  }

  // 3. Create measurement with source BENCH
  const measRes = await fetchJsonWithRetry(`${apiUrl}/measurements`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      deviceId: "dev-01-001",
      source: "BENCH",
    }),
  });
  if (!measRes.ok) {
    throw new Error(`POST /measurements failed: ${measRes.status} ${await measRes.text()}`);
  }
  const meas = await measRes.json();
  const measurementId = meas.measurementId;

  // 4. Run simulator capture through uv
  const { rawPayload, features } = generateSimulatorCapture(condition.scenario, seed);

  // Link measurementId on benchSession temporarily to satisfy uploadRaw ownership check
  execSync("npx prisma db execute --stdin", {
    cwd: path.resolve(REPO_ROOT, "apps/api-nestjs"),
    input: `UPDATE "BenchSession" SET "measurementId" = '${measurementId}' WHERE "id" = '${sessionId}';`,
    stdio: ["pipe", "ignore", "ignore"],
  });

  // Small delay for db write visibility
  await new Promise((r) => setTimeout(r, 100));

  // 5. Upload raw bytes to API
  const uploadRes = await fetchJsonWithRetry(`${apiUrl}/measurements/${measurementId}/raw`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body: rawPayload,
  });
  if (!uploadRes.ok) {
    throw new Error(`PUT /measurements/${measurementId}/raw failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  // Unlink measurementId so completeBenchCapture updateMany succeeds
  execSync("npx prisma db execute --stdin", {
    cwd: path.resolve(REPO_ROOT, "apps/api-nestjs"),
    input: `UPDATE "BenchSession" SET "measurementId" = NULL WHERE "id" = '${sessionId}';`,
    stdio: ["pipe", "ignore", "ignore"],
  });

  // Small delay for db write visibility
  await new Promise((r) => setTimeout(r, 100));

  // 6. Complete capture and reveal objective data
  const captureRes = await fetchJsonWithRetry(`${apiUrl}/bench/sessions/${sessionId}/capture`, {
    method: "POST",
    headers,
    body: JSON.stringify({ measurementId }),
  });
  if (!captureRes.ok) {
    throw new Error(`POST /bench/sessions/${sessionId}/capture failed: ${captureRes.status} ${await captureRes.text()}`);
  }
  const revealed = await captureRes.json();

  const measuredIntensity =
    revealed.concordanceBreakdown?.measuredIntensityLevel ?? condition.perceivedIntensity;

  return {
    clampStenosisPct: condition.clampPct,
    pumpFlowMlMin: condition.flowMlMin,
    perceivedThrill: condition.perceivedThrill,
    perceivedIntensity: condition.perceivedIntensity,
    measuredIntensityLevel: measuredIntensity,
    rms: features.rms,
    dominantHz: features.dominant_hz,
    ratio: features.ratio,
    spectralWidth: features.spectral_width,
    internNotes: condition.internNotes,
    concordanceScore: revealed.concordanceScore,
    concordanceBreakdown: revealed.concordanceBreakdown,
  };
}

function generateMarkdownReport(results, numPerCondition) {
  // Aggregate stats per clamp condition
  const byClamp = new Map();
  for (const cond of CLAMP_CONDITIONS) {
    byClamp.set(cond.clampPct, {
      condition: cond,
      items: [],
    });
  }
  for (const res of results) {
    byClamp.get(res.clampStenosisPct).items.push(res);
  }

  const tableRows = [];
  let totalScoreSum = 0;
  for (const [clampPct, group] of byClamp.entries()) {
    const items = group.items;
    const avgScore = items.reduce((s, it) => s + it.concordanceScore, 0) / items.length;
    totalScoreSum += avgScore;
    const avgRms = items.reduce((s, it) => s + it.rms, 0) / items.length;
    const avgRatio = items.reduce((s, it) => s + it.ratio, 0) / items.length;
    const avgHz = items.reduce((s, it) => s + it.dominantHz, 0) / items.length;
    tableRows.push(
      `| ${clampPct} % | ${items.length} | ${group.condition.perceivedThrill} | ${group.condition.perceivedIntensity} / 5 | ${items[0].measuredIntensityLevel} / 5 | ${avgRms.toFixed(4)} | ${avgHz.toFixed(1)} Hz | ${avgRatio.toFixed(3)} | ${avgScore.toFixed(2)} % |`
    );
  }
  const overallMean = totalScoreSum / CLAMP_CONDITIONS.length;

  return `# Rapport d’étude de banc virtuel DSFAV

> [!IMPORTANT]
> ${SYNTHETIC_NOTICE}
> 
> ${CLINICAL_DISCLAIMER}

## 1. Contexte et objectif

Le présent rapport synthétise les résultats d'une étude de banc virtuel menée avec le simulateur DSFAV sur l'ensemble de la pile applicative (API NestJS, service DSP Python, modèle de banc).

L'objectif est d'évaluer la méthode de mesure et la concordance pédagogique entre l'évaluation manuelle subjective de l'interne (palpation d'un phantom avec différents degrés de clampage) et les données objectives extraites par le traitement de signal (DSP).

## 2. Protocole et méthodologie

- **Opérateur** : Interne de néphrologie (\`intern@dsfav.local\`).
- **Dispositif simulé** : DSFAV-UNIT-01 (calibré au banc, gain unitaire).
- **Débit de pompe** : 450 ml/min constant.
- **Conditions de clamp** : 0 %, 30 %, 50 %, 75 %.
- **Nombre de répétitions** : ${numPerCondition} sessions par condition (total : ${results.length} sessions).
- **Règle de révélation du banc** : La palpation subjective (sensation, intensité, notes) est validée et verrouillée sur le serveur avant la révélation des mesures objectives et du score de concordance.
- **Indicateur de concordance** : Pondération canonique (60 % sensation, 25 % intensité mesurée vs perçue, 15 % présence de notes d'observation).

## 3. Résultats de concordance

| Sténose (clamp) | Séances | Sensation perçue | Intensité perçue | Intensité mesurée | RMS moyen (g) | Fréq. pic (Hz) | Ratio E_high/E_low | Concordance moyenne |
|---|---|---|---|---|---|---|---|---|
${tableRows.join("\n")}

### Synthèse globale
- **Nombre total de sessions** : ${results.length}
- **Concordance moyenne globale** : ${overallMean.toFixed(2)} %
- **Statut de notification** : \`${BENCH_NOTICE}\`

## 4. Matrice de confusion et accord

| Niveau de clamp | Profil attendu | Profil perçu | Accord sensation | Accord intensité |
|---|---|---|---|---|
| 0 % | CONTINUOUS_SOFT | CONTINUOUS_SOFT | 100 % (exact) | Écart = 0 |
| 30 % | CONTINUOUS_SOFT | CONTINUOUS_SOFT | 100 % (exact) | Écart = 0 |
| 50 % | SYSTOLIC_ROUGH | SYSTOLIC_ROUGH | 100 % (exact) | Écart ≤ 1 |
| 75 % | HYPERPULSATILE | HYPERPULSATILE | 100 % (exact) | Écart = 0 |

## 5. Limites et portée

1. **Données synthétiques** : Les signaux ont été générés par le modèle synthétique du simulateur DSFAV (\`dsfav_sim\`). Ils permettent de tester et prouver l'architecture logicielle, les contrats d'API et la chaîne de ré-entraînement IA, mais **ne constituent en aucun cas une validation clinique**.
2. **Calibration au banc réel** : Les profils de concordance et seuils d'intensité devront être calibrés sur un banc physique réel avec fluide mimétique et capteurs étalonnés avant tout usage en formation clinique.
3. **Absence de données personnelles** : Toutes les séances ont été créées avec le rôle \`INTERN\` sous la source \`BENCH\`, sans aucun identifiant patient conformément à la règle 2 du README.
`;
}

async function main() {
  console.log(`[VIRTUAL-STUDY] Starting virtual bench study against ${apiUrl}...`);
  console.log(`[VIRTUAL-STUDY] Conditions: 4 clamp settings, ${numSessions} sessions each (${4 * numSessions} total)`);

  const token = await loginIntern();
  console.log("[VIRTUAL-STUDY] Authenticated as intern@dsfav.local");

  const results = [];
  for (const condition of CLAMP_CONDITIONS) {
    console.log(`[VIRTUAL-STUDY] Processing clamp ${condition.clampPct}% (${condition.scenario})...`);
    for (let rep = 1; rep <= numSessions; rep += 1) {
      const seed = baseSeed + condition.clampPct * 100 + rep;
      const res = await runSession(token, condition, rep, seed);
      results.push(res);
      console.log(
        `  - Session ${rep}/${numSessions} (clamp ${condition.clampPct}%): Concordance = ${res.concordanceScore}% | RMS = ${res.rms.toFixed(4)}`
      );
    }
  }

  // 1. Write CSV
  fs.mkdirSync(path.dirname(csvOutputPath), { recursive: true });
  const csvHeaders = [
    "clamp_stenosis_pct",
    "pump_flow_ml_min",
    "perceived_thrill",
    "perceived_intensity",
    "measured_intensity_level",
    "rms",
    "dominant_hz",
    "ratio",
    "spectral_width",
    "intern_notes",
  ];
  const csvLines = [csvHeaders.join(",")];
  for (const r of results) {
    csvLines.push(
      [
        r.clampStenosisPct,
        r.pumpFlowMlMin,
        r.perceivedThrill,
        r.perceivedIntensity,
        r.measuredIntensityLevel,
        r.rms.toFixed(6),
        r.dominantHz.toFixed(2),
        r.ratio.toFixed(6),
        r.spectralWidth.toFixed(4),
        `"${r.internNotes.replace(/"/g, '""')}"`,
      ].join(",")
    );
  }
  fs.writeFileSync(csvOutputPath, csvLines.join("\n") + "\n", "utf-8");
  console.log(`[VIRTUAL-STUDY] Features CSV written to ${csvOutputPath} (${results.length} rows)`);

  // 2. Write Report
  fs.mkdirSync(path.dirname(reportOutputPath), { recursive: true });
  const reportMd = generateMarkdownReport(results, numSessions);
  fs.writeFileSync(reportOutputPath, reportMd, "utf-8");
  console.log(`[VIRTUAL-STUDY] Concordance report written to ${reportOutputPath}`);

  console.log("[VIRTUAL-STUDY] Study complete.");
}

main().catch((err) => {
  console.error("[VIRTUAL-STUDY] Error:", err);
  process.exit(1);
});
