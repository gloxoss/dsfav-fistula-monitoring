import type { DeviceInfo, PatientSummary } from "../model/types";

/**
 * Données de démonstration uniquement : jamais utilisées en mode direct.
 * Tout résultat produit à partir de ces données porte `demo: true` et
 * l'étiquette « Mode démonstration » jusqu'à l'écran.
 */
export const DEMO_INITIAL_PRESSURE_KPA = 4.8;

export const DEMO_PATIENTS: PatientSummary[] = [
  {
    idPseudo: "PT-CAS-8841",
    fistulaType: "radio-céphalique",
    side: "gauche",
    sessionsCount: 42,
    baselineStatus: "ACTIVE",
    lastMeasurementDate: "03/11 07:52",
    lastStatus: "UNUSUAL_EVOLUTION",
  },
  {
    idPseudo: "PT-CAS-7120",
    fistulaType: "brachio-céphalique",
    side: "droite",
    sessionsCount: 31,
    baselineStatus: "ACTIVE",
    lastMeasurementDate: "03/11 07:40",
    lastStatus: "NORMAL",
  },
  {
    idPseudo: "PT-CAS-6603",
    fistulaType: "radio-céphalique",
    side: "droite",
    sessionsCount: 2,
    baselineStatus: "BUILDING",
    baselineStep: 2,
    lastMeasurementDate: "03/11 07:31",
    lastStatus: "BASELINE_BUILDING",
  },
  {
    idPseudo: "PT-CAS-9015",
    fistulaType: "brachio-basilique",
    side: "gauche",
    sessionsCount: 18,
    baselineStatus: "ACTIVE",
    lastMeasurementDate: "03/11 07:18",
    lastStatus: "REJECTED_QUALITY",
  },
  {
    idPseudo: "PT-CAS-5530",
    fistulaType: "radio-céphalique",
    side: "gauche",
    sessionsCount: 56,
    baselineStatus: "ACTIVE",
    lastMeasurementDate: "01/11",
    lastStatus: "TO_CONFIRM",
  },
];

export const DEMO_DEVICE: DeviceInfo = {
  id: "DSFAV-UNIT-01",
  name: "DSFAV-UNIT-01",
  batteryPct: 86,
  connected: true,
  syncState: "SYNCED",
  macTail: "A4:1F",
  firmwareVersion: "1.3.2",
  estimatedMeasuresLeft: 24,
};

// Simulated 16 freq bins x 25 time steps STFT matrix (values 0.0 to 1.0)
export const DEMO_STFT_PREVIEW: number[][] = Array.from({ length: 16 }, (_, row) =>
  Array.from({ length: 25 }, (_, col) => {
    // Energy peak around row 3 (approx 75 Hz) and row 7 (approx 180 Hz)
    const baseEnergy = Math.exp(-Math.pow(row - 3, 2) / 4) * 0.8 + Math.exp(-Math.pow(row - 7, 2) / 3) * 0.5;
    const pulse = 0.2 * Math.sin((col / 25) * Math.PI * 4);
    return Math.max(0.05, Math.min(1.0, +(baseEnergy + pulse).toFixed(3)));
  }),
);
