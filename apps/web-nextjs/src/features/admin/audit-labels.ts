export type AuditCategory = "notes" | "references" | "devices" | "measures" | "settings" | "other";

export const AUDIT_CATEGORIES: Array<{ id: AuditCategory; label: string }> = [
  { id: "notes", label: "Notes et suivis" },
  { id: "references", label: "Références" },
  { id: "devices", label: "Appareils" },
  { id: "measures", label: "Mesures" },
  { id: "settings", label: "Paramètres" },
];

const ACTIONS: Record<string, { label: string; category: AuditCategory }> = {
  CLINICAL_NOTE_CREATED: { label: "Note clinique ajoutée", category: "notes" },
  FOLLOW_UP_INTENT_CREATED: { label: "Intention de suivi enregistrée", category: "notes" },
  REBASELINE: { label: "Référence recalculée", category: "references" },
  BASELINE_LOCKED: { label: "Référence verrouillée", category: "references" },
  DEVICE_CALIBRATED: { label: "Appareil étalonné", category: "devices" },
  DEVICE_VIEWED: { label: "Appareil consulté", category: "devices" },
  MEASUREMENT_ABANDONED: { label: "Mesure abandonnée", category: "measures" },
  THRESHOLD_PROPOSAL_APPROVED: { label: "Proposition de seuil approuvée", category: "settings" },
};

export function actionInfo(action: string): { label: string; category: AuditCategory } {
  return ACTIONS[action] ?? { label: action, category: "other" };
}

const ROLES: Record<string, string> = {
  NURSE: "Infirmier",
  NEPHROLOGIST: "Néphrologue",
  INTERN: "Interne",
  ADMIN: "Administrateur",
};

export function roleLabel(role: string): string {
  return ROLES[role] ?? role;
}

const ENTITIES: Record<string, string> = {
  ClinicalNote: "Note",
  FollowUpIntent: "Suivi",
  PatientPseudo: "Patient",
  BaselineVersion: "Référence",
  Device: "Appareil",
  Measurement: "Mesure",
  ConfigVersion: "Configuration",
};

export function entityLabel(entity: string): string {
  return ENTITIES[entity] ?? entity;
}

const DETAIL_LABELS: Record<string, string> = {
  calibrationGain: "Gain",
  reason: "Motif",
  baselineLocked: "Référence verrouillée",
};

function detailValue(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "oui" : "non";
  if (typeof value === "number") return key === "calibrationGain" ? String(value).replace(".", ",") : String(value).replace(".", ",");
  return String(value);
}

export function describeDetails(after: Record<string, unknown> | null | undefined): Array<{ label: string; value: string }> {
  if (!after) return [];
  return Object.entries(after).map(([key, value]) => ({ label: DETAIL_LABELS[key] ?? key, value: detailValue(key, value) }));
}
