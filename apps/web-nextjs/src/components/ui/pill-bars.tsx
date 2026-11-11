import type { ReactNode } from "react";
import { PillBarChart } from "@/components/charts/chart-primitives";

export interface PillBarItem {
  id: string;
  label: string;
  value: number;
  isBaseline?: boolean;
  isSelected?: boolean;
  color?: string;
  displayValue?: string;
}

export interface PillBarsProps {
  items: PillBarItem[];
  threshold?: { value: number; label: string };
  max?: number;
  height?: number;
  unit?: string;
  className?: string;
  header?: ReactNode;
}

export function PillBars({ items, threshold, max: customMax, height = 180, unit = "", className = "", header }: PillBarsProps) {
  const calculatedMax = Math.max(...items.map((item) => item.value), threshold?.value ?? 0, 1);
  const maxValue = (customMax ?? calculatedMax) * 1.15;

  return (
    <div className={`space-y-3 ${className}`}>
      {header}
      <PillBarChart items={items} threshold={threshold} height={height} maxValue={maxValue} unit={unit} />
    </div>
  );
}
