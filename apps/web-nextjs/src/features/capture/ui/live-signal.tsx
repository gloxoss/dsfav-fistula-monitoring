"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type uPlot from "uplot";
import { CircleAlert } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { PressureStrip } from "@/components/charts/pressure-strip";
import {
  type ClinicalPressureThresholds,
  CANONICAL_PRESSURE_THRESHOLDS,
} from "@/components/ui/pressure-gauge";
import type { CaptureFrame, CaptureStreamStatus } from "../model/types";
import { PRESSURE_STABLE_REQUIRED_SEC } from "../model/constants";

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

export interface LiveSignalProps {
  status: CaptureStreamStatus;
  deviceConnected?: boolean;
  elapsedSec: number;
  targetDurationSec?: number;
  frames: CaptureFrame[];
  artifactIntervals?: Array<{ startSec: number; endSec: number }>;
  pressureKpa: number;
  pressureThresholds?: Partial<ClinicalPressureThresholds>;
  stablePressureSec?: number;
  attemptsCount?: number;
  isFrozen: boolean;
  onToggleFreeze: () => void;
  onStart: () => void;
  onStop: () => void;
  onRetry: () => void;
  className?: string;
}

export function LiveSignal({
  status,
  deviceConnected = false,
  elapsedSec,
  targetDurationSec = 25.0,
  frames,
  artifactIntervals = [],
  pressureKpa,
  pressureThresholds,
  stablePressureSec = PRESSURE_STABLE_REQUIRED_SEC,
  attemptsCount = 1,
  isFrozen,
  onToggleFreeze,
  onStart,
  onStop,
  onRetry,
  className = "",
}: LiveSignalProps) {
  const plotHostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  // Real pixel width of the plot host: the SVG grid overlay uses it as its viewBox so grid and canvas stay aligned 1:1.
  const [hostWidthPx, setHostWidthPx] = useState(600);
  const framesRef = useRef(frames);
  const artifactIntervalsRef = useRef(artifactIntervals);
  const hasRealDataRef = useRef(frames.length > 0);
  const systemPrefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const minKpa = pressureThresholds?.pressureMinKpa ?? CANONICAL_PRESSURE_THRESHOLDS.pressureMinKpa;
  const lowKpa = pressureThresholds?.pressureLowKpa ?? CANONICAL_PRESSURE_THRESHOLDS.pressureLowKpa;
  const highKpa = pressureThresholds?.pressureHighKpa ?? CANONICAL_PRESSURE_THRESHOLDS.pressureHighKpa;
  const maxKpa = pressureThresholds?.pressureMaxKpa ?? CANONICAL_PRESSURE_THRESHOLDS.pressureMaxKpa;

  // Pressure boundary gate logic
  const isPressureTooLow = pressureKpa < minKpa;
  const isPressureTooHigh = pressureKpa > maxKpa;
  const isPressureBlocked = isPressureTooLow || isPressureTooHigh;
  const isPressureStable = stablePressureSec >= PRESSURE_STABLE_REQUIRED_SEC;
  const formattedStableSec = stablePressureSec.toFixed(1).replace(".", ",");

  useEffect(() => {
    framesRef.current = frames;
    artifactIntervalsRef.current = artifactIntervals;
    hasRealDataRef.current = frames.length > 0;
  }, [artifactIntervals, frames]);

  // Blocked pressure is explained once, by the PressureStrip above; here only the stability wait is stated.
  const disabledReasonText =
    !isPressureBlocked && !isPressureStable && status === "idle"
      ? `Maintenez la pression stable pendant 1,0 s (actuel : ${formattedStableSec} s).`
      : "";

  // uPlot setup with non-overlapping padding
  useEffect(() => {
    const host = plotHostRef.current;
    if (!host) return;
    let plot: uPlot | null = null;
    let cancelled = false;
    let resize: ResizeObserver | null = null;
    if (typeof window.matchMedia !== "function") {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }),
      });
    }
    void import("uplot").then(({ default: UPlot }) => {
      if (cancelled) return;
      const hostWidth = Math.max(240, host.clientWidth);
      setHostWidthPx(hostWidth);
      const padLeft = 48;
      const padRight = 20;
      const padBottom = 24;
      const padTop = 16;
      const data: uPlot.AlignedData = [[], [], []];
      // A canvas cannot resolve CSS variables: read the real colors from the theme.
      const css = getComputedStyle(document.documentElement);
      const thrillColor = css.getPropertyValue("--primary").trim() || "#1f7a64";
      const motionColor = css.getPropertyValue("--artifact").trim() || "#6c63ff";
      const options: uPlot.Options = {
        width: hostWidth,
        height: 240,
        scales: {
          x: { time: false, range: [0, targetDurationSec] },
          // One shared g scale, so both traces read against the same axis labels.
          g: { range: [-0.5, 0.5] },
        },
        axes: [
          { scale: "x", show: false },
          { scale: "g", show: false },
        ],
        series: [
          {},
          { label: "Thrill · ADXL355", scale: "g", stroke: thrillColor, width: 2, points: { show: false } },
          { label: "Mouvement · LIS2DW12", scale: "g", stroke: motionColor, width: 1.6, points: { show: false } },
        ],
        padding: [padTop, padRight, padBottom, padLeft],
        legend: { show: false },
        cursor: { show: false },
      };
      plot = new UPlot(options, data, host);
      plotRef.current = plot;
      if (framesRef.current.length > 0) {
        plot.setData([
          framesRef.current.map((frame) => frame.timestampSec),
          framesRef.current.map((frame) => frame.thrillValue),
          framesRef.current.map((frame) => frame.motionValue),
        ]);
      }
      resize = new ResizeObserver(() => {
        const width = Math.max(240, host.clientWidth);
        plot?.setSize({ width, height: 240 });
        setHostWidthPx(width);
      });
      resize.observe(host);
    }).catch(() => {
      // uPlot unavailable or failed in test runner; SVG fallback active
    });
    return () => {
      cancelled = true;
      resize?.disconnect();
      plot?.destroy();
      plotRef.current = null;
    };
  }, [targetDurationSec]);

  useEffect(() => {
    if (isFrozen) return;
    const instance = plotRef.current;
    if (!instance) return;
    try {
      const xs = frames.map((frame) => frame.timestampSec);
      const thrill = frames.map((frame) => frame.thrillValue);
      const motion = frames.map((frame) => frame.motionValue);
      instance.setData([xs, thrill, motion]);
    } catch {
      // jsdom environment lacks canvas 2d context methods
    }
  }, [frames, isFrozen]);

  const formattedElapsed = elapsedSec.toFixed(1).replace(".", ",");
  const progressPct = Math.min(100, (elapsedSec / targetDurationSec) * 100);

  // Compute motion epochs > 0.08 g
  const motionEpochs: Array<{ startSec: number; endSec: number }> = [];
  if (artifactIntervals.length > 0) {
    motionEpochs.push(...artifactIntervals);
  } else if (frames.length > 0) {
    let start: number | null = null;
    for (const f of frames) {
      if (f.motionValue > 0.08 || f.isArtifact) {
        if (start === null) start = f.timestampSec;
      } else if (start !== null) {
        motionEpochs.push({ startSec: start, endSec: f.timestampSec });
        start = null;
      }
    }
    if (start !== null) {
      motionEpochs.push({ startSec: start, endSec: +(frames[frames.length - 1]!.timestampSec + 0.1).toFixed(1) });
    }
  }

  const hasArtifact = frames.some((f) => f.isArtifact || f.motionValue > 0.08);
  const artifactSeconds = frames.filter((f) => f.isArtifact || f.motionValue > 0.08).length * 0.1;
  const artifactText = hasArtifact
    ? `Présence d'artéfacts de mouvement (${artifactSeconds.toFixed(1).replace(".", ",")} s).`
    : "Aucun artéfact.";
  const signalSummaryText = `Signal thrill et mouvement en direct. Durée : ${formattedElapsed} s sur ${targetDurationSec.toFixed(1).replace(".", ",")} s. Pression : ${pressureKpa.toFixed(1).replace(".", ",")} kPa. ${artifactText}`;

  // SVG Chart layout constants (48px left margin, 24px bottom margin preventing label overlap)
  const svgWidth = hostWidthPx;
  const svgHeight = 240;
  const margin = { top: 16, right: 20, bottom: 24, left: 48 };
  const pWidth = svgWidth - margin.left - margin.right;
  const pHeight = svgHeight - margin.top - margin.bottom;

  // X ticks: 0, 5, 10, 15, 20, 25 s
  const xTicks = [0, 5, 10, 15, 20, 25].filter((v) => v <= targetDurationSec);
  // Y symmetric scale: +0.50 g to -0.50 g
  const yTicks = [0.5, 0.25, 0, -0.25, -0.5];

  const mapX = (sec: number) => margin.left + Math.max(0, Math.min(1, sec / targetDurationSec)) * pWidth;
  const mapY = (val: number) => {
    const norm = (val - -0.5) / 1.0;
    return margin.top + pHeight * (1 - norm);
  };

  return (
    <div
      className={`bg-surface text-text-primary rounded-[28px] p-6 lg:p-7 flex flex-col justify-between shadow-[var(--shadow-card)] space-y-4 ${className}`}
    >
      {/* Top row: Legends, Freeze button and Timer */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Legends with canonical colors */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
          <div className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
            <span className="text-text-primary">Thrill ADXL355 (teal)</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-artifact shrink-0" />
            <span className="text-text-secondary">Mouvement LIS2DW12 (violet)</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleFreeze}
          className="min-h-9 shrink-0 cursor-pointer rounded-full border border-hairline bg-well px-3 text-xs text-text-secondary transition-colors hover:bg-hairline focus-visible:ring-2 focus-visible:ring-primary"
        >
          {isFrozen || systemPrefersReducedMotion ? "Reprendre le défilement" : "Figer l’affichage"}
        </button>
      </div>

      {/* Timer and a real progress bar on one line, the bar taking the remaining width */}
      <div className="flex items-center gap-4">
        <div className="flex shrink-0 items-baseline gap-1 font-tabular">
          <span className="text-3xl lg:text-4xl font-medium tracking-tight text-text-primary">{formattedElapsed}</span>
          <span className="text-sm font-normal text-text-muted">/ {targetDurationSec.toFixed(1).replace(".", ",")} s</span>
        </div>
        <div
          role="progressbar"
          aria-label="Progression de la mesure"
          aria-valuemin={0}
          aria-valuemax={targetDurationSec}
          aria-valuenow={Math.min(targetDurationSec, Math.round(elapsedSec * 10) / 10)}
          aria-valuetext={`${formattedElapsed} s sur ${targetDurationSec.toFixed(1).replace(".", ",")} s`}
          className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-hairline"
        >
          <div
            style={{ width: `${progressPct}%` }}
            className="h-full rounded-full bg-primary transition-[width] duration-100"
          />
        </div>
      </div>

      {/* Waveform tile */}
      <div className="relative bg-well rounded-[20px] min-h-[240px] flex items-center justify-center overflow-hidden">
        {/* SVG background grid, axes, symmetric scale in g, flat zero line and motion masks */}
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          role="presentation"
        >
          {/* Light Grid Lines */}
          {yTicks.map((val) => {
            const y = mapY(val);
            const isZero = val === 0;
            return (
              <g key={`ygrid-${val}`}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={margin.left + pWidth}
                  y2={y}
                  stroke={isZero ? "var(--text-muted)" : "var(--hairline)"}
                  strokeWidth={isZero ? "1.2" : "0.75"}
                  strokeDasharray={isZero ? undefined : "3 3"}
                />
                <text
                  x={margin.left - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="9.5"
                  fill={isZero ? "var(--text-primary)" : "var(--text-muted)"}
                  fontWeight={isZero ? "600" : "500"}
                >
                  {val > 0 ? `+${val.toFixed(2).replace(".", ",")}` : val.toFixed(2).replace(".", ",")} g
                </text>
              </g>
            );
          })}

          {xTicks.map((val) => {
            const x = mapX(val);
            return (
              <g key={`xgrid-${val}`}>
                <line
                  x1={x}
                  y1={margin.top}
                  x2={x}
                  y2={margin.top + pHeight}
                  stroke="var(--hairline)"
                  strokeWidth="0.75"
                  strokeDasharray="3 3"
                />
                <text
                  x={x}
                  y={margin.top + pHeight + 16}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="var(--text-muted)"
                  fontWeight="500"
                >
                  {val} s
                </text>
              </g>
            );
          })}

          {/* Zero baseline */}
          <line
            x1={margin.left}
            y1={mapY(0)}
            x2={margin.left + pWidth}
            y2={mapY(0)}
            stroke="var(--text-muted)"
            strokeWidth="1.2"
          />

          {/* Motion epochs shaded overlay */}
          {motionEpochs.map((epoch, idx) => {
            const left = mapX(epoch.startSec);
            const right = mapX(epoch.endSec);
            const w = Math.max(4, right - left);
            return (
              <g key={`motion-mask-${idx}`}>
                <rect
                  data-testid="motion-epoch-mask"
                  x={left}
                  y={margin.top}
                  width={w}
                  height={pHeight}
                  fill="var(--artifact)"
                  fillOpacity="0.18"
                  stroke="var(--artifact)"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              </g>
            );
          })}

        </svg>

        {/* uPlot Host Container for High-Frequency Streaming */}
        <div
          ref={plotHostRef}
          role="img"
          className="w-full h-[240px] block relative z-10"
          aria-label="Graphique des signaux thrill et mouvement"
          aria-describedby="signal-waveform-summary"
        />

        {/* The summary is strictly sr-only */}
        <div id="signal-waveform-summary" className="sr-only" aria-live="polite">
          {signalSummaryText}
        </div>

        {/* Idle message centered */}
        {frames.length === 0 && (status === "idle" || status === "ready") ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            {deviceConnected && isPressureStable && !isPressureBlocked ? (
              <span className="text-sm font-medium text-normal-text bg-normal-tint px-4 py-2 rounded-full border border-normal/25 shadow-xs">
                Prêt : appuyez pour démarrer
              </span>
            ) : (
              <span className="text-sm font-medium text-text-muted bg-white/95 px-4 py-2 rounded-full border border-hairline shadow-xs">
                {deviceConnected ? "Posez le capteur sur la FAV" : "En attente de l'appareil"}
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Repositioning attempt indicator when attempt > 1 */}
      {attemptsCount > 1 ? (
        <div className="flex items-center gap-2 rounded-full bg-accent-tint px-3 py-1 text-xs font-medium text-warning-text self-start">
          <CircleAlert className="w-3.5 h-3.5" />
          <span>Tentative {attemptsCount} sur 3 (repositionnement)</span>
        </div>
      ) : null}

      {/* Reusable Medical PressureStrip Component */}
      <PressureStrip
        pressureKpa={pressureKpa}
        status={status}
        stablePressureSec={stablePressureSec}
        minKpa={minKpa}
        lowKpa={lowKpa}
        highKpa={highKpa}
        maxKpa={maxKpa}
      />

      {/* Action buttons and pressure gate warnings */}
      <div
        data-testid="capture-actions"
        className="sticky bottom-0 z-10 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-4 rounded-b-[28px] border-t border-hairline bg-surface px-6 py-4 shadow-[0_-6px_12px_-10px_rgba(20,27,52,0.18)] lg:-mx-7 lg:-mb-7 lg:px-7"
      >
        {/* Left side: status / warning text */}
        <div className="text-xs">
          {disabledReasonText ? (
            <span className="font-semibold text-warning-text">{disabledReasonText}</span>
          ) : isPressureBlocked ? null : (
            <span className="text-text-muted">
              Maintenez une pression stable entre {lowKpa.toFixed(1).replace(".", ",")} et {highKpa.toFixed(1).replace(".", ",")} kPa
            </span>
          )}
        </div>

        {/* Right side: Pill buttons */}
        <div className="flex items-center gap-3">
          {status === "capturing" ? (
            <>
              <PillButton variant="secondary" size="md" onClick={onRetry}>
                Recommencer
              </PillButton>
              <PillButton variant="primary" size="md" onClick={onStop}>
                Arrêter l’acquisition
              </PillButton>
            </>
          ) : (
            <PillButton
              variant="primary"
              size="md"
              disabled={isPressureBlocked || !isPressureStable}
              onClick={onStart}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                onStart();
              }}
            >
              Démarrer l’acquisition
            </PillButton>
          )}
        </div>
      </div>
    </div>
  );
}
