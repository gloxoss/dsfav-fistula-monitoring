"use client";

import { useId } from "react";

export interface SpectrogramChartProps {
  matrix?: number[][] | null;
  durationSec?: number;
  maxFreqHz?: number;
  dominantFreqHz?: number | null;
  height?: number;
  compact?: boolean;
  title?: string;
  className?: string;
}

function energyToColor(norm: number): string {
  const clamped = Math.max(0, Math.min(1, norm));
  // Colormap quantized to design tokens: dark navy -> primary teal -> cyan -> accent mustard -> critical coral
  if (clamped < 0.15) return "var(--bg-dark)";
  if (clamped < 0.35) return "var(--primary)";
  if (clamped < 0.60) return "var(--cyan)";
  if (clamped < 0.85) return "var(--accent)";
  return "var(--critical)";
}

export function SpectrogramChart({
  matrix,
  durationSec = 25,
  maxFreqHz = 400,
  dominantFreqHz,
  height = 240,
  compact = false,
  title = "Spectrogramme (temps / fréquence)",
  className = "",
}: SpectrogramChartProps) {
  const gradientId = useId();

  const numRows = matrix && matrix.length > 0 ? matrix.length : 0;
  const numCols = numRows > 0 && matrix![0] ? matrix![0].length : 0;

  let minVal = 0;
  let maxVal = 1;
  if (numRows > 0 && numCols > 0) {
    let min = Infinity;
    let max = -Infinity;
    for (let r = 0; r < numRows; r++) {
      const row = matrix![r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const v = row[c] ?? 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      minVal = min;
      maxVal = max;
    }
  }

  const freqTicks = [0, 100, 200, 300, 400].filter((f) => f <= maxFreqHz);
  const timeTicks = [0, 5, 10, 15, 20, 25].filter((t) => t <= durationSec);

  const plotMargin = {
    top: 14,
    right: 20,
    bottom: 28,
    left: compact ? 36 : 48,
  };
  const svgWidth = 800;
  const plotWidth = svgWidth - plotMargin.left - plotMargin.right;
  const plotHeight = height - plotMargin.top - plotMargin.bottom;

  const freqToY = (f: number) => {
    const ratio = Math.max(0, Math.min(1, f / maxFreqHz));
    return plotMargin.top + plotHeight * (1 - ratio);
  };

  const timeToX = (t: number) => {
    const ratio = Math.max(0, Math.min(1, t / durationSec));
    return plotMargin.left + plotWidth * ratio;
  };

  const dominantY =
    dominantFreqHz !== null && dominantFreqHz !== undefined
      ? freqToY(dominantFreqHz)
      : null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-text-label">{title}</span>
        {dominantFreqHz !== null && dominantFreqHz !== undefined ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            Pic {Math.round(dominantFreqHz)} Hz
          </span>
        ) : null}
      </div>

      <div className="relative overflow-hidden rounded-[20px] bg-well p-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${height}`}
          style={{ maxHeight: `${height}px` }}
          className="w-full h-[240px] block select-none"
          role="img"
          aria-label={`${title} : durée ${durationSec} s, fréquence maximale ${maxFreqHz} Hz`}
        >
          <defs>
            <linearGradient id={`energy-grad-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--bg-dark)" />
              <stop offset="30%" stopColor="var(--primary)" />
              <stop offset="60%" stopColor="var(--cyan)" />
              <stop offset="85%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--critical)" />
            </linearGradient>
          </defs>

          {/* Background */}
          <rect
            x={plotMargin.left}
            y={plotMargin.top}
            width={plotWidth}
            height={plotHeight}
            fill="var(--bg-dark)"
            rx="4"
          />

          {/* Grid lines */}
          {freqTicks.map((freq) => {
            const y = freqToY(freq);
            return (
              <line
                key={`fline-${freq}`}
                x1={plotMargin.left}
                y1={y}
                x2={plotMargin.left + plotWidth}
                y2={y}
                stroke="var(--bg-dark)"
                strokeOpacity="0.4"
                strokeWidth="0.8"
                strokeDasharray="3 3"
              />
            );
          })}
          {timeTicks.map((time) => {
            const x = timeToX(time);
            return (
              <line
                key={`tline-${time}`}
                x1={x}
                y1={plotMargin.top}
                x2={x}
                y2={plotMargin.top + plotHeight}
                stroke="var(--bg-dark)"
                strokeOpacity="0.4"
                strokeWidth="0.8"
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Cells */}
          {numRows > 0 && numCols > 0
            ? matrix!.map((row, rIdx) => {
                const cellHeight = plotHeight / numRows;
                const cellWidth = plotWidth / numCols;
                const y = plotMargin.top + (numRows - 1 - rIdx) * cellHeight;

                return row.map((val, cIdx) => {
                  const x = plotMargin.left + cIdx * cellWidth;
                  const norm = (val - minVal) / (maxVal - minVal || 1);
                  const color = energyToColor(norm);

                  return (
                    <rect
                      key={`c-${rIdx}-${cIdx}`}
                      data-testid="spectrogram-cell"
                      x={x}
                      y={y}
                      width={cellWidth + 0.3}
                      height={cellHeight + 0.3}
                      fill={color}
                    />
                  );
                });
              })
            : null}

          {/* Dominant frequency indicator line */}
          {dominantY !== null ? (
            <g>
              <line
                x1={plotMargin.left}
                y1={dominantY}
                x2={plotMargin.left + plotWidth}
                y2={dominantY}
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <circle
                cx={plotMargin.left + plotWidth - 6}
                cy={dominantY}
                r="3"
                fill="var(--accent)"
              />
            </g>
          ) : null}

          {/* Y Axis (Frequency in Hz) */}
          {freqTicks.map((freq) => {
            const y = freqToY(freq);
            return (
              <text
                key={`ftext-${freq}`}
                x={plotMargin.left - 6}
                y={y + 3.5}
                textAnchor="end"
                fontSize={compact ? "9" : "10"}
                fill="var(--text-muted)"
                fontWeight="500"
              >
                {freq} Hz
              </text>
            );
          })}

          {/* X Axis (Time in s) */}
          {timeTicks.map((time) => {
            const x = timeToX(time);
            return (
              <text
                key={`ttext-${time}`}
                x={x}
                y={plotMargin.top + plotHeight + 16}
                textAnchor="middle"
                fontSize={compact ? "9" : "10"}
                fill="var(--text-muted)"
                fontWeight="500"
              >
                {time} s
              </text>
            );
          })}
        </svg>

        {/* Legend bar under the plot */}
        <div className="mt-2 flex items-center justify-between text-[11px] text-text-secondary px-2">
          <span className="flex items-center gap-1.5">
            <span className="font-medium text-text-label">Énergie :</span>
            <span>Faible</span>
          </span>
          <div className="mx-2 h-2 flex-1 max-w-[120px] rounded-full overflow-hidden bg-hairline">
            <div
              className="h-full w-full"
              style={{
                background: "linear-gradient(to right, var(--bg-dark), var(--primary), var(--cyan), var(--accent), var(--critical))",
              }}
            />
          </div>
          <span>Élevée</span>
        </div>
      </div>
    </div>
  );
}

export { SpectrogramChart as Spectrogram };
