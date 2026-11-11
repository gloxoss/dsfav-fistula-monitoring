"use client";

export interface PressureStripProps {
  pressureKpa: number;
  status?: string;
  stablePressureSec?: number;
  minKpa?: number;
  lowKpa?: number;
  highKpa?: number;
  maxKpa?: number;
  className?: string;
}

export function PressureStrip({
  pressureKpa,
  status = "idle",
  stablePressureSec = 1.0,
  minKpa = 2.5,
  lowKpa = 3.0,
  highKpa = 8.5,
  maxKpa = 9.0,
  className = "",
}: PressureStripProps) {
  const isPressureTooLow = pressureKpa < minKpa;
  const isPressureTooHigh = pressureKpa > maxKpa;
  const isPressureBlocked = isPressureTooLow || isPressureTooHigh;
  const isPressureStable = stablePressureSec >= 1.0;
  const formattedStableSec = stablePressureSec.toFixed(1).replace(".", ",");
  const formattedPressure = pressureKpa.toFixed(1).replace(".", ",");

  const scaleMax = 12.0;
  const clampedPressure = Math.max(0, Math.min(scaleMax, pressureKpa));
  const indicatorPct = (clampedPressure / scaleMax) * 100;

  return (
    <div
      className={`space-y-1.5 w-full ${className}`}
      role="meter"
      aria-label="Pression de contact exercée sur la fistule"
      aria-valuenow={pressureKpa}
      aria-valuemin={0}
      aria-valuemax={scaleMax}
      aria-valuetext={`${formattedPressure} kPa${isPressureBlocked ? " (bloqué)" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
        <span className="text-text-label">Pression de contact</span>
        <span className="text-[11px] text-text-muted">
          Plage recommandée : {lowKpa.toFixed(1).replace(".", ",")} à {highKpa.toFixed(1).replace(".", ",")} kPa
        </span>
        <div className="flex items-baseline gap-1 font-tabular">
          <span className="text-sm font-semibold text-text-primary">
            {formattedPressure}
          </span>
          <span className="text-text-muted text-[11px]">kPa</span>
        </div>
      </div>

      {/* 5-zone range bar (0 to 12 kPa scale) */}
      <div className="relative h-3 w-full bg-hairline rounded-full overflow-hidden p-0.5">
        {/* Zone 1: Blocked low (0 to 2.5 kPa) */}
        <div
          title="Appui insuffisant (0 à 2,5 kPa)"
          className="absolute top-0 bottom-0 bg-critical/20"
          style={{ left: "0%", width: `${(minKpa / scaleMax) * 100}%` }}
        />
        {/* Zone 2: Amber low (2.5 to 3.0 kPa) */}
        <div
          title="Toléré faible (2,5 à 3,0 kPa)"
          className="absolute top-0 bottom-0 bg-warning/40"
          style={{
            left: `${(minKpa / scaleMax) * 100}%`,
            width: `${((lowKpa - minKpa) / scaleMax) * 100}%`,
          }}
        />
        {/* Zone 3: Target green (3.0 to 8.5 kPa) */}
        <div
          title="Plage optimale recommandée (3,0 à 8,5 kPa)"
          className="absolute top-0 bottom-0 bg-normal/75"
          style={{
            left: `${(lowKpa / scaleMax) * 100}%`,
            width: `${((highKpa - lowKpa) / scaleMax) * 100}%`,
          }}
        />
        {/* Zone 4: Amber high (8.5 to 9.0 kPa) */}
        <div
          title="Toléré élevé (8,5 à 9,0 kPa)"
          className="absolute top-0 bottom-0 bg-warning/40"
          style={{
            left: `${(highKpa / scaleMax) * 100}%`,
            width: `${((maxKpa - highKpa) / scaleMax) * 100}%`,
          }}
        />
        {/* Zone 5: Blocked high (9.0 to 12.0 kPa) */}
        <div
          title="Risque de compression (9,0 à 12,0 kPa)"
          className="absolute top-0 bottom-0 bg-critical/20"
          style={{
            left: `${(maxKpa / scaleMax) * 100}%`,
            width: `${((scaleMax - maxKpa) / scaleMax) * 100}%`,
          }}
        />

        {/* Live indicator needle */}
        <div
          className="absolute top-0 bottom-0 w-1.5 bg-dark rounded-full shadow-xs -translate-x-1/2 transition-all duration-150"
          style={{ left: `${indicatorPct}%` }}
        />
      </div>

      {/* Strip status line with blocked state text below 2.5 and above 9.0 */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px]">
        {isPressureTooLow ? (
          <span data-testid="pressure-strip-blocked" className="font-semibold text-critical-text">
            Appui insuffisant (&lt; 2,5 kPa) · acquisition bloquée
          </span>
        ) : isPressureTooHigh ? (
          <span data-testid="pressure-strip-blocked" className="font-semibold text-critical-text">
            Risque de compression (&gt; 9,0 kPa) · acquisition bloquée
          </span>
        ) : !isPressureStable && status === "idle" ? (
          <span className="font-medium text-warning-text">
            Stabilisation en cours ({formattedStableSec} / 1,0 s)
          </span>
        ) : (
          <span className="font-medium text-text-secondary">
            Plage cible : {lowKpa.toFixed(1).replace(".", ",")} à {highKpa.toFixed(1).replace(".", ",")} kPa (toléré {minKpa.toFixed(1).replace(".", ",")} à {maxKpa.toFixed(1).replace(".", ",")} kPa)
          </span>
        )}
        <span className="text-text-muted font-tabular">
          {isPressureBlocked ? "Bloqué" : "Actif"}
        </span>
      </div>
    </div>
  );
}
