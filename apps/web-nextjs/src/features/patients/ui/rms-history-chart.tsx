"use client";

import { Card } from "@/components/ui/card";
import { SessionTrendChart } from "@/components/charts/session-trend-chart";
import type { BaselineFeatures, SessionView } from "../model/types";

export interface RmsHistoryChartProps {
  sessions: SessionView[];
  baseline: BaselineFeatures | null;
  className?: string;
}

export function RmsHistoryChart({ sessions, baseline, className = "" }: RmsHistoryChartProps) {
  const rows = sessions.filter((session) => session.rmsG !== null).slice(-14);
  if (rows.length === 0) return null;

  return (
    <Card className={`space-y-3 min-w-0 ${className}`}>
      <SessionTrendChart
        sessions={sessions}
        baseline={
          baseline
            ? {
                rmsG: baseline.rmsG,
                peakFreqHz: baseline.peakFreqHz,
                stenosisRatio: baseline.stenosisRatio,
              }
            : null
        }
        height={260}
      />
    </Card>
  );
}
