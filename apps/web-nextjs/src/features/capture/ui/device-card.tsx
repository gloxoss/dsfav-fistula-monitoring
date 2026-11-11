"use client";

import type { DeviceInfo } from "../model/types";

export interface DeviceCardProps {
  device?: DeviceInfo | null;
  onRetryConnection?: () => void;
  className?: string;
}

function lastSeenLabel(iso?: string): string {
  if (!iso) return "Jamais vu";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

export function DeviceCard({ device, onRetryConnection, className = "" }: DeviceCardProps) {
  // Registered in the fleet but not reachable now: show what is known, say what to do.
  if (device && !device.connected) {
    return (
      <div
        className={`bg-dark text-white rounded-[28px] p-6 flex flex-col gap-5 relative overflow-hidden min-h-[220px] shadow-sm ${className}`}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-text-muted">{device.name}</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-warning-tint text-warning-text font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-warning-text" />
              Hors ligne
            </span>
          </div>
          <p className="text-sm text-text-muted">
            Appareil enregistré, en attente de connexion Wi-Fi. Allumez le boîtier et approchez-le du poste.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs">
          <div>
            <dt className="text-text-muted">Dernier contact</dt>
            <dd className="mt-0.5 text-sm font-medium">{lastSeenLabel(device.lastSeenAt)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Dernière batterie connue</dt>
            <dd className="mt-0.5 text-sm font-medium font-tabular">{device.batteryPct} %</dd>
          </div>
        </dl>
        {onRetryConnection ? (
          <button
            type="button"
            onClick={onRetryConnection}
            className="mt-4 self-start inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition"
          >
            Réessayer la détection
          </button>
        ) : null}
      </div>
    );
  }

  // No device known at all
  if (!device) {
    return (
      <div
        className={`bg-dark text-white rounded-[28px] p-6 flex flex-col justify-between relative overflow-hidden min-h-[220px] shadow-sm ${className}`}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-text-muted font-medium">
              Appareil DSFAV
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-critical-tint text-critical-text font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-critical-text" />
              Non détecté
            </span>
          </div>
          <p className="text-sm text-text-muted">
            Aucun boîtier connecté via Wi-Fi. Vérifiez l’allumage de l’appareil.
          </p>
        </div>

        {onRetryConnection ? (
          <button
            type="button"
            onClick={onRetryConnection}
            className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition"
          >
            Réessayer la détection
          </button>
        ) : null}
      </div>
    );
  }

  const isLowBattery = device.batteryPct <= 20 && device.batteryPct > 15;
  const isCriticalBattery = device.batteryPct <= 15;

  return (
    <div
      className={`bg-dark text-white rounded-[28px] p-6 flex flex-col justify-between relative overflow-hidden min-h-[220px] shadow-sm ${className}`}
    >
      {/* Top row */}
      <div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
            {device.name}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-cyan font-medium">
            <svg
              className="w-4 h-4 text-cyan"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
            <span>Synchronisé</span>
          </div>
        </div>

        {/* Battery section */}
        <div className="mt-4 flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-medium tracking-tight font-tabular">
              {device.batteryPct}
            </span>
            <span className="text-base text-text-muted font-normal">%</span>
          </div>
          <span className="text-xs text-text-muted font-normal">
            environ {device.estimatedMeasuresLeft} mesures
          </span>
        </div>

        {/* Thick battery pill bar */}
        <div className="mt-2.5 h-3.5 w-full bg-white/10 rounded-full overflow-hidden p-0.5">
          <div
            style={{ width: `${Math.min(100, Math.max(0, device.batteryPct))}%` }}
            className={`h-full rounded-full transition-all duration-300 ${
              isCriticalBattery
                ? "bg-critical-text"
                : isLowBattery
                ? "bg-warning-text"
                : "bg-cyan"
            }`}
          />
        </div>
      </div>

      {/* State banners */}
      <div className="mt-3">
        {isCriticalBattery ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-critical-tint text-critical-text">
            Rechargez l’appareil pour continuer
          </div>
        ) : isLowBattery ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-warning-tint text-warning-text">
            Rechargez avant le prochain patient
          </div>
        ) : (
          <span className="text-xs text-text-muted">Batterie optimale</span>
        )}
      </div>

      {/* 3D Pulse Ribbon decorative element in lower right */}
      <div
        className="absolute -right-6 -bottom-6 w-28 h-28 pointer-events-none opacity-40"
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
          <path
            d="M10 80 Q 30 20, 60 70 T 100 40"
            stroke="url(#pulseGrad)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="pulseGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--artifact)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Round cyan arrow button */}
      <button
        type="button"
        aria-label="Détails de l'appareil"
        className="absolute bottom-5 right-5 w-10 h-10 rounded-full bg-cyan/15 hover:bg-cyan/30 text-cyan flex items-center justify-center transition shadow-sm"
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
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </button>
    </div>
  );
}
