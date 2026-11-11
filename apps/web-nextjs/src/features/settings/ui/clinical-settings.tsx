"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/shell/page-title";
import { formatDateTime } from "@/libs/format/datetime";
import type { UserRole } from "@/libs/auth/session";

export interface ConfigProposalItem {
  id: string;
  authorId: string;
  authorRole: string;
  createdAt: string;
  threshold: number;
  confidenceNote?: string;
}

export interface ClinicalSettingsProps {
  role: UserRole | null;
  userId: string | null;
  activeVersion: number | null;
  activeDate: string | null;
  thresholds: Record<string, number>;
  initialProposals?: ConfigProposalItem[];
  onPropose: (input: { threshold: number; confidenceNote: string }) => Promise<{ id: string }>;
  onApprove: (proposalId: string) => Promise<void>;
}

interface SettingMeta {
  label: string;
  unit?: string;
}

const SETTINGS_METADATA: Record<string, SettingMeta> = {
  deviationScore: { label: "Seuil de déviation", unit: "σ" },
  thresholdSigma: { label: "Seuil de déviation", unit: "σ" },
  pressureMinKpa: { label: "Pression minimale", unit: "kPa" },
  pressureLowKpa: { label: "Pression minimale recommandée", unit: "kPa" },
  pressureHighKpa: { label: "Pression maximale recommandée", unit: "kPa" },
  pressureMaxKpa: { label: "Pression maximale", unit: "kPa" },
  motionRmsG: { label: "Seuil de mouvement", unit: "g" },
  motionThresholdG: { label: "Seuil de mouvement", unit: "g" },
  cleanDurationSec: { label: "Durée propre minimale", unit: "s" },
  cleanTimeMinSec: { label: "Durée propre minimale", unit: "s" },
  durationSec: { label: "Durée d'acquisition", unit: "s" },
  captureDurationSec: { label: "Durée d'acquisition", unit: "s" },
  batteryWarningPct: { label: "Alerte batterie", unit: "%" },
  batteryWarnPct: { label: "Alerte batterie", unit: "%" },
  batteryBlockPct: { label: "Blocage batterie", unit: "%" },
  gainTolerancePct: { label: "Tolérance d'écart de gain", unit: "%" },
  consecutiveAlerts: { label: "Alertes consécutives requises", unit: "séances" },
  stdFloorPct: { label: "Plancher d'écart-type", unit: "%" },
};

function thresholdLabel(key: string): string {
  return (
    SETTINGS_METADATA[key]?.label ??
    key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase())
  );
}

const SETTING_GROUPS: Array<{ title: string; keys: string[] }> = [
  { title: "Pression de contact", keys: ["pressureMinKpa", "pressureLowKpa", "pressureHighKpa", "pressureMaxKpa"] },
  {
    title: "Qualité du signal",
    keys: ["motionThresholdG", "motionRmsG", "cleanTimeMinSec", "cleanDurationSec", "durationSec", "captureDurationSec", "stdFloorPct"],
  },
  { title: "Détection et référence", keys: ["thresholdSigma", "deviationScore", "consecutiveAlerts"] },
  { title: "Appareils", keys: ["batteryWarnPct", "batteryWarningPct", "batteryBlockPct", "gainTolerancePct"] },
];

function groupThresholds(thresholds: Record<string, number>): Array<{ title: string; entries: Array<[string, number]> }> {
  const used = new Set<string>();
  const groups = SETTING_GROUPS.map((group) => {
    const entries = group.keys.filter((key) => key in thresholds).map((key) => [key, thresholds[key] as number] as [string, number]);
    entries.forEach(([key]) => used.add(key));
    return { title: group.title, entries };
  }).filter((group) => group.entries.length > 0);
  const others = Object.entries(thresholds).filter(([key]) => !used.has(key));
  return others.length ? [...groups, { title: "Autres paramètres", entries: others }] : groups;
}

function formatSettingValue(key: string, value: number): string {
  const meta = SETTINGS_METADATA[key];
  const formatted = Number(value).toString().replace(".", ",");
  return meta?.unit ? `${formatted} ${meta.unit}` : formatted;
}

export function ClinicalSettings({
  role,
  userId,
  activeVersion,
  activeDate,
  thresholds,
  initialProposals = [],
  onPropose,
  onApprove,
}: ClinicalSettingsProps) {
  const [threshold, setThreshold] = useState(String(thresholds.deviationScore ?? thresholds.thresholdSigma ?? ""));
  const [confidenceNote, setConfidenceNote] = useState("");
  const [proposals, setProposals] = useState<ConfigProposalItem[]>(initialProposals);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (role !== "NEPHROLOGIST" && role !== "ADMIN") {
    return (
      <p role="alert" className="rounded-xl border border-hairline bg-surface p-4 text-sm text-text-primary">
        Accès réservé au néphrologue et à l’administrateur.
      </p>
    );
  }

  async function propose(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(threshold);
    if (role !== "NEPHROLOGIST" || !Number.isFinite(parsed) || parsed <= 0 || !confidenceNote.trim()) return;
    setIsSaving(true);
    setError(null);
    setStatus(null);
    try {
      const proposal = await onPropose({ threshold: parsed, confidenceNote: confidenceNote.trim() });
      const newProposal: ConfigProposalItem = {
        id: proposal.id,
        authorId: userId ?? "unknown",
        authorRole: "Néphrologue",
        createdAt: new Date().toISOString(),
        threshold: parsed,
        confidenceNote: confidenceNote.trim(),
      };
      setProposals((prev) => [newProposal, ...prev.filter((p) => p.id !== proposal.id)]);
      setStatus(`Brouillon ${proposal.id.slice(0, 8)} enregistré, en attente d’un autre néphrologue.`);
      setConfidenceNote("");
    } catch {
      setError("La proposition n’a pas pu être enregistrée.");
    } finally {
      setIsSaving(false);
    }
  }

  async function approveProposal(targetProposalId: string) {
    if (role !== "NEPHROLOGIST" || !targetProposalId.trim()) return;
    setIsSaving(true);
    setError(null);
    setStatus(null);
    try {
      await onApprove(targetProposalId.trim());
      setStatus("Configuration validée. L’événement d’audit a été enregistré.");
      setProposals((prev) => prev.filter((p) => p.id !== targetProposalId));
    } catch {
      setError("La validation a échoué. Vérifiez le brouillon et le rôle du relecteur.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle first="Paramètres" rest="cliniques" subtitle="Les seuils sont des paramètres à valider au banc, jamais des vérités cliniques." />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex rounded-full bg-primary-tint px-3 py-1 text-sm font-semibold text-primary">
            {activeVersion === null ? "Aucune configuration active." : `Version ${activeVersion}`}
            {activeDate ? ` · ${formatDateTime(activeDate)?.slice(0, 10)}` : ""}
          </span>
          <span className="text-xs text-text-secondary">Configuration active, appliquée à toutes les mesures.</span>
        </div>

        {Object.entries(thresholds).length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {groupThresholds(thresholds).map((group) => (
              <section key={group.title} className="rounded-[20px] bg-surface p-5 shadow-[var(--shadow-card)]">
                <h2 className="text-sm font-semibold text-text-primary">{group.title}</h2>
                <dl className="mt-2 divide-y divide-hairline">
                  {group.entries.map(([key, value]) => (
                    <div key={key} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <dt className="text-sm text-text-secondary">{thresholdLabel(key)}</dt>
                      <dd className="flex items-center gap-2">
                        <span className="font-tabular text-sm font-semibold text-text-primary">{formatSettingValue(key, value)}</span>
                        <span className="rounded-full bg-warning-tint px-2.5 py-0.5 text-[11px] font-medium text-warning-text">
                          À calibrer au banc
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        ) : <p className="text-sm text-text-secondary">Aucun seuil disponible dans la configuration active.</p>}
      </div>

      <Card className="space-y-5">
        {role === "ADMIN" ? (
          <p className="text-sm text-text-secondary">Brouillons : à venir</p>
        ) : (
          <>
            <form onSubmit={propose} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="deviation-threshold" className="text-sm font-medium text-text-primary">
                  Nouveau seuil de déviation (écarts-types)
                </label>
                <input
                  id="deviation-threshold"
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                  className="min-h-11 w-full max-w-xs rounded-xl border border-hairline bg-surface px-3 py-2 text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="threshold-confidence-note" className="text-sm font-medium text-text-primary">
                  Note de confiance et motif
                </label>
                <textarea
                  id="threshold-confidence-note"
                  required
                  rows={3}
                  value={confidenceNote}
                  onChange={(event) => setConfidenceNote(event.target.value)}
                  className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                />
              </div>
              <button type="submit" disabled={isSaving || !confidenceNote.trim()} className="min-h-11 cursor-pointer rounded-full bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                {isSaving ? "Enregistrement…" : "Enregistrer le brouillon"}
              </button>
            </form>

            <div className="space-y-4 border-t border-hairline pt-5">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  Propositions en attente d’approbation
                </h3>
                <p className="text-xs text-text-secondary">
                  Chaque proposition doit être validée par un néphrologue distinct de son auteur (règle des quatre yeux).
                </p>
              </div>

              {proposals.length === 0 ? (
                <div className="rounded-xl border border-hairline bg-well p-4 text-sm text-text-secondary">
                  Aucune proposition en attente de validation.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-well text-text-secondary">
                      <tr>
                        <th className="p-3">Identifiant</th>
                        <th className="p-3">Auteur</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Valeur proposée</th>
                        <th className="p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {proposals.map((prop) => {
                        const isAuthor = prop.authorId === userId;
                        const shortId = prop.id.length > 8 ? `${prop.id.slice(0, 8)}…` : prop.id;
                        return (
                          <tr key={prop.id} className="align-middle">
                            <td className="p-3 font-mono text-xs text-text-primary" title={prop.id}>
                              {shortId}
                            </td>
                            <td className="p-3 text-xs text-text-secondary">
                              {prop.authorRole}
                            </td>
                            <td className="p-3 font-tabular text-xs text-text-secondary">
                              {new Date(prop.createdAt).toLocaleDateString("fr-FR")}
                            </td>
                            <td className="p-3 font-tabular text-sm font-medium text-text-primary">
                              {String(prop.threshold).replace(".", ",")} σ
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                                <button
                                  type="button"
                                  onClick={() => void approveProposal(prop.id)}
                                  disabled={isSaving || isAuthor}
                                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {isSaving ? "Validation…" : "Approuver"}
                                </button>
                                {isAuthor ? (
                                  <span className="text-[11px] text-critical-text">
                                    Un autre néphrologue doit valider ce brouillon.
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {error ? <p role="alert" className="text-sm text-critical-text">{error}</p> : null}
        {status ? <p role="status" className="break-words text-sm text-text-secondary">{status}</p> : null}
      </Card>
    </div>
  );
}
