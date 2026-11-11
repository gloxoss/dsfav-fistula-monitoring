"use client";

export interface SparklineProps {
  values: number[];
  colorVar?: string;
  label?: string;
  unit?: string;
  className?: string;
  height?: number;
  baseline?: number;
  startAtZero?: boolean;
}

export function Sparkline({
  values,
  colorVar = "var(--primary)",
  label = "Évolution",
  unit = "",
  className = "",
  height = 56,
  baseline,
  startAtZero,
}: SparklineProps) {
  const recentValues = values.slice(-10);

  if (recentValues.length === 0) {
    return null;
  }

  const formattedValues = recentValues
    .map((v) => `${v.toString().replace(".", ",")}${unit ? ` ${unit}` : ""}`)
    .join(", ");

  const hasZeroDomain = startAtZero || unit === "g" || unit === "kPa";
  const allDomainValues = baseline !== undefined ? [...recentValues, baseline] : recentValues;

  const rawMin = Math.min(...allDomainValues);
  const rawMax = Math.max(...allDomainValues);

  let domainMin = hasZeroDomain ? 0 : rawMin;
  let domainMax = rawMax;

  if (hasZeroDomain) {
    // Sensible domain starting at 0 for energy/pressure + at least 25% padding
    domainMax = rawMax > 0 ? +(rawMax * 1.25).toFixed(3) : 1;
  } else {
    // 25% padding so line reflects the real size of change
    const pad = (rawMax - rawMin || 1) * 0.25;
    domainMin = Math.max(0, +(rawMin - pad).toFixed(3));
    domainMax = +(rawMax + pad).toFixed(3);
  }

  const range = domainMax - domainMin || 1;

  const width = 200;
  const paddingX = 8;
  const paddingY = 8;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const points = recentValues.map((v, idx) => {
    const x =
      recentValues.length === 1
        ? width / 2
        : paddingX + (idx / (recentValues.length - 1)) * innerWidth;
    const y = paddingY + innerHeight * (1 - (v - domainMin) / range);
    return { x: +x.toFixed(1), y: +y.toFixed(1) };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  const lastPoint = points[points.length - 1];

  let baselineY: number | null = null;
  if (baseline !== undefined && baseline !== null) {
    const rawY = paddingY + innerHeight * (1 - (baseline - domainMin) / range);
    if (rawY >= paddingY && rawY <= height - paddingY) {
      baselineY = +rawY.toFixed(1);
    }
  }

  return (
    <div
      role="img"
      aria-label={`${label} : ${formattedValues}`}
      className={`w-full ${className}`}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-[56px] block overflow-visible select-none"
        aria-hidden="true"
      >
        {baselineY !== null ? (
          <line
            data-testid="sparkline-baseline"
            x1={paddingX}
            y1={baselineY}
            x2={width - paddingX}
            y2={baselineY}
            stroke="var(--text-muted)"
            strokeWidth="1"
            strokeDasharray="3 3"
            strokeOpacity="0.5"
          />
        ) : null}
        <path
          d={pathD}
          fill="none"
          stroke={colorVar}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {lastPoint ? (
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="2.5"
            fill={colorVar}
          />
        ) : null}
      </svg>
    </div>
  );
}
