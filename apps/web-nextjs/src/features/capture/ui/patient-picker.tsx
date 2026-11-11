"use client";

import { useState } from "react";
import type { PatientSummary } from "../model/types";

export interface PatientPickerProps {
  currentPatient?: PatientSummary | null;
  patientsList: PatientSummary[];
  onSelectPatient: (patient: PatientSummary) => void;
  onUnknownPatientCode: (code: string) => void;
}

export function PatientPicker({
  currentPatient,
  patientsList,
  onSelectPatient,
  onUnknownPatientCode,
}: PatientPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const query = customInput.trim().toUpperCase();
  const visiblePatients = query
    ? patientsList.filter((p) => p.idPseudo.toUpperCase().includes(query))
    : patientsList;

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = customInput.trim().toUpperCase();
    if (!trimmed) return;

    const found = patientsList.find((p) => p.idPseudo.toUpperCase() === trimmed);
    if (found) {
      onSelectPatient(found);
    } else {
      onUnknownPatientCode(trimmed);
    }
    setCustomInput("");
    setIsOpen(false);
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {/* Patient code selector pill */}
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-2 h-12 px-4 rounded-full bg-surface border border-hairline text-text-primary hover:bg-well transition focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
          <span className="font-mono text-sm font-medium">
            {currentPatient ? currentPatient.idPseudo : "Sélectionner un patient"}
          </span>
          <svg
            className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isOpen ? (
          <div
            role="listbox"
            className="absolute left-0 mt-2 w-80 bg-surface rounded-2xl p-2 shadow-lg border border-hairline z-40 space-y-2 animate-in fade-in zoom-in-95"
          >
            <form onSubmit={handleCustomSubmit} className="p-1">
              <label htmlFor="patient-search-input" className="sr-only">
                Code patient
              </label>
              <input
                id="patient-search-input"
                type="text"
                placeholder="Filtrer ou saisir un code"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-xl bg-well border border-hairline font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary text-text-primary"
              />
            </form>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {visiblePatients.length === 0 ? (
                <p className="px-3 py-2 text-xs text-text-secondary">
                  {patientsList.length === 0
                    ? "Aucun patient enregistré. Saisissez un code pour en créer un."
                    : "Aucun patient ne correspond. Entrée pour utiliser ce code."}
                </p>
              ) : null}
              {visiblePatients.map((patient) => {
                const isSelected = currentPatient?.idPseudo === patient.idPseudo;
                return (
                  <button
                    key={patient.idPseudo}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectPatient(patient);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                      isSelected ? "bg-primary text-white" : "hover:bg-well text-text-primary"
                    }`}
                  >
                    <div>
                      <div className="font-mono font-medium text-sm">{patient.idPseudo}</div>
                      <div className={isSelected ? "text-white/80" : "text-text-secondary"}>
                        FAV {patient.fistulaType} {patient.side}
                      </div>
                    </div>
                    {patient.baselineStatus === "BUILDING" ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning-tint whitespace-nowrap shrink-0 text-warning-text font-semibold">
                        Référence en cours
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Fistula detail pill */}
      {currentPatient ? (
        <div className="inline-flex items-center h-12 px-4 rounded-full bg-surface border border-hairline text-xs font-medium text-text-secondary shadow-sm">
          FAV {currentPatient.fistulaType} {currentPatient.side}
        </div>
      ) : null}

      {/* Settings / Bell buttons */}
      <button
        type="button"
        aria-label="Notifications"
        className="w-12 h-12 rounded-full bg-surface border border-hairline flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-well transition shadow-sm"
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      </button>
    </div>
  );
}
