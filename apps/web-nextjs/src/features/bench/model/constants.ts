import type { ClampStenosisPct, PerceivedThrill } from "./types";

export const BENCH_FLOW_MIN_ML_MIN = 200;
export const BENCH_FLOW_MAX_ML_MIN = 800;
export const BENCH_FLOW_STEP_ML_MIN = 10;
export const BENCH_FLOW_DEFAULT_ML_MIN = 450;

export const BENCH_CLAMP_OPTIONS: readonly ClampStenosisPct[] = [0, 30, 50, 75];
export const BENCH_CLAMP_DEFAULT_PCT: ClampStenosisPct = 50;

export const BENCH_INTENSITY_MIN = 1;
export const BENCH_INTENSITY_MAX = 5;

export const BENCH_LOW_CONCORDANCE_PCT = 60;

export const BENCH_BREAKDOWN_MAX = {
  sensation: 60,
  intensity: 25,
  notes: 15,
} as const;

export const BENCH_SETUP_PLACEHOLDER = "Configurez le banc pour commencer";

export const BENCH_BLIND_MESSAGE =
  "Les signaux sont masqués jusqu’à la validation de votre observation";

export const BENCH_NO_DATA = "—";

export const BENCH_SIMULATION_LINE = "Simulation sur banc, pas de donnée patient";

export const BENCH_EXPECTED_PROFILE_CALIBRATING = "à calibrer";

export const BENCH_TEACHING_SENTENCE =
  "Un rétrécissement accélère le flux et modifie le contenu fréquentiel du signal. Interprétation pédagogique, pas un diagnostic.";

export const BENCH_DEMO_LABEL = "Mode démonstration";

export const BENCH_CAPTURE_REJECTED_FALLBACK =
  "Mesure inutilisable : mouvement trop important. Recommencez la capture.";

export const BENCH_CAPTURE_START_ERROR = "Impossible de démarrer la capture. Réessayez.";

export const BENCH_CAPTURE_IDLE_HINT =
  "Le serveur vérifie que votre palpation est enregistrée avant de révéler la mesure.";

export const BENCH_CAPTURE_CREATING = "Création de la mesure…";

export const BENCH_CAPTURE_RUNNING = "Capture en cours…";

export const BENCH_CAPTURE_RECEIVED = "Mesure reçue. Révélez la comparaison.";

export const BENCH_DEVICE_CONFIG_ERROR =
  "Aucun appareil de banc n'est configuré. Contactez l'administration.";

export const BENCH_GENERIC_ERROR = "Impossible de joindre le serveur. Réessayez.";

export const PERCEIVED_THRILL_LABELS: Record<PerceivedThrill, string> = {
  CONTINUOUS_SOFT: "Thrill continu doux",
  SYSTOLIC_ROUGH: "Renforcement systolique rugueux",
  WEAK_DAMPENED: "Faible, amorti",
  HYPERPULSATILE: "Hyperpulsatile",
  ABSENT: "Absent",
};

export const PERCEIVED_THRILL_ORDER: readonly PerceivedThrill[] = [
  "CONTINUOUS_SOFT",
  "SYSTOLIC_ROUGH",
  "WEAK_DAMPENED",
  "HYPERPULSATILE",
  "ABSENT",
];
