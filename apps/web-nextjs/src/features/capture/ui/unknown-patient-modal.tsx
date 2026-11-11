"use client";

import { useEffect, useRef } from "react";
import { PillButton } from "@/components/ui/pill-button";

let lastInteractedElement: HTMLElement | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (e) => {
      if (e.target instanceof HTMLElement && !e.target.closest('[role="dialog"]')) {
        lastInteractedElement = e.target;
      }
    },
    true,
  );
}

export interface UnknownPatientModalProps {
  isOpen: boolean;
  idPseudo: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnknownPatientModal({
  isOpen,
  idPseudo,
  onConfirm,
  onCancel,
}: UnknownPatientModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const active = document.activeElement as HTMLElement | null;
      previousFocusRef.current =
        active && active !== document.body ? active : lastInteractedElement;
      dialogRef.current?.focus();
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
        onCancel();
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen, onCancel]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
      onCancel();
      return;
    }

    if (e.key === "Tab") {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement;

      if (e.shiftKey) {
        if (activeElement === firstElement || activeElement === dialog) {
          e.preventDefault();
          lastElement.focus();
        } else {
          const currentIndex = focusableElements.indexOf(activeElement);
          if (currentIndex > 0) {
            e.preventDefault();
            focusableElements[currentIndex - 1].focus();
          } else {
            e.preventDefault();
            lastElement.focus();
          }
        }
      } else {
        if (activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        } else if (activeElement === dialog) {
          e.preventDefault();
          firstElement.focus();
        } else {
          const currentIndex = focusableElements.indexOf(activeElement);
          if (currentIndex >= 0 && currentIndex < focusableElements.length - 1) {
            e.preventDefault();
            focusableElements[currentIndex + 1].focus();
          } else {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    }
  }

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-labelledby="unknown-patient-title"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark/40 backdrop-blur-sm outline-none"
    >
      <div className="w-full max-w-md bg-surface rounded-[28px] p-6 lg:p-8 shadow-xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-full bg-warning-tint text-warning-text mx-auto flex items-center justify-center">
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 id="unknown-patient-title" className="text-xl font-semibold text-text-primary">
            Nouveau patient détecté
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Ce code n’a pas d’historique. Créer un nouvel historique pour{" "}
            <span className="font-mono font-medium text-text-primary">{idPseudo}</span> ?
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <PillButton variant="secondary" size="md" onClick={onCancel}>
            Annuler
          </PillButton>
          <PillButton variant="primary" size="md" onClick={onConfirm}>
            Créer
          </PillButton>
        </div>
      </div>
    </div>
  );
}
