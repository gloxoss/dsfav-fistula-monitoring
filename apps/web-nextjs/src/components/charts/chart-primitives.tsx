"use client";

import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PillBarItem } from "@/components/ui/pill-bars";
export { Sparkline, type SparklineProps } from "./sparkline";

export interface PillBarChartProps {
  items: PillBarItem[];
  height: number;
  maxValue: number;
  threshold?: { value: number; label: string };
  unit: string;
}

export function PillBarChart({ items, height, maxValue, threshold, unit }: PillBarChartProps) {
  const data = items.map((item) => ({ ...item, chartValue: item.value }));

  return (
    <div>
      {threshold ? <p className="sr-only">{threshold.label}</p> : null}
      <svg aria-hidden="true" className="sr-only" focusable="false">
        <defs>
          <pattern id="pill-bar-hatch-accessible" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="var(--bg-well)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--text-muted)" strokeWidth="2" />
          </pattern>
        </defs>
        <rect width="1" height="1" fill="url(#pill-bar-hatch-accessible)" />
      </svg>
      <div className="w-full min-w-[240px]" role="img" aria-label="Graphique en barres arrondies">
        <ResponsiveContainer width="100%" height={height} minWidth={240}>
          <BarChart data={data} margin={{ top: 24, right: 12, bottom: 8, left: 12 }}>
            <defs>
              <pattern id="pill-bar-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <rect width="6" height="6" fill="var(--bg-well)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--text-muted)" strokeWidth="2" />
              </pattern>
            </defs>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--text-label)", fontSize: 11 }} />
            <YAxis hide domain={[0, maxValue]} />
            <Tooltip
              cursor={false}
              formatter={(value) => [`${Number(value).toString().replace(".", ",")}${unit ? ` ${unit}` : ""}`, ""]}
              contentStyle={{ border: 0, borderRadius: 12, backgroundColor: "var(--bg-dark)", color: "white" }}
            />
            {threshold ? (
              <ReferenceLine
                y={threshold.value}
                stroke="var(--text-label)"
                strokeDasharray="4 4"
                label={({ viewBox }) => {
                  const x = Number(viewBox?.x ?? 0) + Number(viewBox?.width ?? 0) - 106;
                  const y = Number(viewBox?.y ?? 0) - 9;
                  return (
                    <g>
                      <rect x={x} y={y} width="100" height="18" rx="9" fill="var(--bg-dark)" />
                      <text x={x + 50} y={y + 12} textAnchor="middle" fill="white" fontSize="10" fontWeight="500">
                        {threshold.label}
                      </text>
                    </g>
                  );
                }}
              />
            ) : null}
            <Bar dataKey="chartValue" maxBarSize={28} radius={[14, 14, 14, 14]} isAnimationActive={false}>
              {data.map((item) => (
                <Cell
                  key={item.id}
                  fill={item.isBaseline ? "url(#pill-bar-hatch)" : item.color ?? (item.isSelected ? "var(--primary)" : "var(--text-secondary)")}
                  stroke={item.isBaseline ? "var(--text-muted)" : "none"}
                />
              ))}
              <LabelList
                dataKey="displayValue"
                position="top"
                content={(props) => {
                  const { x, y, value } = props;
                  if (value == null || typeof x !== "number" || typeof y !== "number") return null;
                  return (
                    <text x={x} y={y - 4} textAnchor="middle" fill="var(--text-primary)" fontSize={11} fontWeight={600}>
                      {String(value)}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs text-text-secondary">
        <summary className="min-h-11 cursor-pointer inline-flex items-center text-text-label underline underline-offset-2">Afficher les données</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">Valeurs du graphique</caption>
          <thead><tr><th scope="col">Séance</th><th scope="col">Valeur</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}><th scope="row" className="font-medium">{item.label}</th><td>{item.displayValue ?? `${item.value.toString().replace(".", ",")}${unit ? ` ${unit}` : ""}`}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}
