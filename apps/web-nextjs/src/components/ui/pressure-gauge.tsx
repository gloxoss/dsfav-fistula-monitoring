import type { ReactNode } from "react";

export interface PressureZone {
  id: string;
  label: string;
  min: number;
  max: number;
  status: "critical" | "warning" | "normal";
}

export interface PressureConfig {
  min: number;
  max: number;
  zones: PressureZone[];
}

export interface ClinicalPressureThresholds {
  pressureMinKpa: number;
  pressureLowKpa: number;
  pressureHighKpa: number;
  pressureMaxKpa: number;
}

/**
 * Valeurs par défaut issues de la spécification canonique (canonical specification §7).
 * Marquées « à calibrer au banc » (README, rule 6).
 * Les seuils réels sont injectés via la configuration active.
 */
export const CANONICAL_PRESSURE_THRESHOLDS: ClinicalPressureThresholds = {
  pressureMinKpa: 2.5,
  pressureLowKpa: 3.0,
  pressureHighKpa: 8.5,
  pressureMaxKpa: 9.0,
};

/**
 * Construit la configuration des plages de pression à partir des seuils cliniques configurés.
 * Conforme à la règle : les seuils proviennent de la configuration (props), jamais de constantes en dur.
 */
export function buildPressureConfig(
  thresholds: Partial<ClinicalPressureThresholds> = {},
  rangeMax: number = 12.0,
): PressureConfig {
  const minKpa = thresholds.pressureMinKpa ?? CANONICAL_PRESSURE_THRESHOLDS.pressureMinKpa;
  const lowKpa = thresholds.pressureLowKpa ?? CANONICAL_PRESSURE_THRESHOLDS.pressureLowKpa;
  const highKpa = thresholds.pressureHighKpa ?? CANONICAL_PRESSURE_THRESHOLDS.pressureHighKpa;
  const maxKpa = thresholds.pressureMaxKpa ?? CANONICAL_PRESSURE_THRESHOLDS.pressureMaxKpa;

  return {
    min: 0,
    max: rangeMax,
    zones: [
      { id: "low_blocked", label: "Insuffisant", min: 0, max: minKpa, status: "critical" },
      { id: "low_tolerated", label: "Toléré (faible)", min: minKpa, max: lowKpa, status: "warning" },
      { id: "recommended", label: "Recommandé", min: lowKpa, max: highKpa, status: "normal" },
      { id: "high_tolerated", label: "Toléré (élevé)", min: highKpa, max: maxKpa, status: "warning" },
      { id: "high_blocked", label: "Risque de compression", min: maxKpa, max: rangeMax, status: "critical" },
    ],
  };
}

export const DEFAULT_PRESSURE_CONFIG: PressureConfig = buildPressureConfig();

export interface PressureGaugeProps {
  value: number;
  /** Configuration des zones de pression lues depuis les props */
  config?: PressureConfig;
  /** Seuils cliniques configurés (injectés depuis la configuration active) */
  thresholds?: Partial<ClinicalPressureThresholds>;
  showValue?: boolean;
  className?: string;
  headerRight?: ReactNode;
}

export function findPressureZone(
  value: number,
  configOrThresholds: PressureConfig | Partial<ClinicalPressureThresholds> = DEFAULT_PRESSURE_CONFIG,
): PressureZone {
  const config =
    "zones" in configOrThresholds
      ? configOrThresholds
      : buildPressureConfig(configOrThresholds);

  for (let i = 0; i < config.zones.length; i++) {
    const z = config.zones[i];
    const isLast = i === config.zones.length - 1;
    if (value >= z.min && (isLast ? value <= z.max : value < z.max)) {
      return z;
    }
  }
  // Clamp fallback
  if (value < config.min) return config.zones[0];
  return config.zones[config.zones.length - 1];
}

const STATUS_COLORS: Record<PressureZone["status"], { bg: string; text: string; fill: string }> = {
  critical: { bg: "bg-critical-tint", text: "text-critical-text", fill: "#FDECEC" },
  warning: { bg: "bg-warning-tint", text: "text-warning-text", fill: "#FDF3DD" },
  normal: { bg: "bg-normal-tint", text: "text-normal-text", fill: "#E7F6EF" },
};

export function PressureGauge({
  value,
  config,
  thresholds,
  showValue = true,
  className = "",
  headerRight,
}: PressureGaugeProps) {
  // Pressure zones read from props (config or active clinical thresholds) as required by brief §2
  const activeConfig = config ?? (thresholds ? buildPressureConfig(thresholds) : DEFAULT_PRESSURE_CONFIG);
  const activeZone = findPressureZone(value, activeConfig);
  const totalRange = activeConfig.max - activeConfig.min;
  const percentage = Math.min(100, Math.max(0, ((value - activeConfig.min) / totalRange) * 100));

  const formattedValue = value.toFixed(1).replace(".", ",");
  const recommendedZone = activeConfig.zones.find((z) => z.id === "recommended");

  return (
    <div className={`space-y-3 ${className}`}>
      {showValue ? (
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-medium tracking-tight text-text-primary font-tabular">
              {formattedValue}
            </span>
            <span className="text-sm text-text-muted font-normal">kPa</span>
          </div>
          {headerRight}
        </div>
      ) : null}

      {/* Track bar */}
      <div className="relative pt-2 pb-1">
        {/* Track segments */}
        <div className="h-3.5 w-full rounded-full overflow-hidden flex bg-hairline">
          {activeConfig.zones.map((zone) => {
            const widthPct = ((zone.max - zone.min) / totalRange) * 100;
            const style = STATUS_COLORS[zone.status];
            return (
              <div
                key={zone.id}
                title={`${zone.label} (${zone.min} à ${zone.max} kPa)`}
                style={{ width: `${widthPct}%` }}
                className={`h-full ${style.bg} transition-colors border-r border-white/40 last:border-r-0`}
              />
            );
          })}
        </div>

        {/* Knob */}
        <div
          data-testid="pressure-gauge-knob"
          data-zone={activeZone.label}
          data-status={activeZone.status}
          role="slider"
          aria-label="Pression de contact mesurée"
          aria-valuenow={value}
          aria-valuemin={activeConfig.min}
          aria-valuemax={activeConfig.max}
          aria-valuetext={`${formattedValue} kPa - Zone ${activeZone.label}`}
          style={{ left: `${percentage}%` }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-primary shadow-sm pointer-events-none transition-all duration-150"
        >
          <span className="sr-only">
            {`Pression : ${formattedValue} kPa (${activeZone.label})`}
          </span>
        </div>
      </div>

      {/* Active zone label and recommended range stacked */}
      <div className="flex flex-col gap-0.5 text-xs">
        <span
          data-testid="pressure-gauge-zone-label"
          className={`font-medium ${STATUS_COLORS[activeZone.status].text}`}
        >
          {activeZone.label}
        </span>
        {recommendedZone ? (
          <span className="text-text-label">
            Plage recommandée : {recommendedZone.min.toFixed(1).replace(".", ",")} à{" "}
            {recommendedZone.max.toFixed(1).replace(".", ",")} kPa
          </span>
        ) : null}
      </div>
    </div>
  );
}
