import { Card } from "@/components/ui/card";
import { PillButton } from "@/components/ui/pill-button";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LockKeyhole } from "lucide-react";
import {
  BENCH_CLAMP_OPTIONS,
  BENCH_FLOW_MAX_ML_MIN,
  BENCH_FLOW_MIN_ML_MIN,
  BENCH_FLOW_STEP_ML_MIN,
} from "../model/constants";
import type { BenchSetup, ClampStenosisPct } from "../model/types";

export interface BenchSetupCardProps {
  setup: BenchSetup;
  onChange: (setup: BenchSetup) => void;
  locked: boolean;
  onInitialize: () => void;
  isInitializing: boolean;
}

export function BenchSetupCard({
  setup,
  onChange,
  locked,
  onInitialize,
  isInitializing,
}: BenchSetupCardProps) {
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Réglage du banc</h2>
        {locked ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-well px-3 py-1 text-xs font-medium text-text-secondary">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Réglage verrouillé
          </span>
        ) : null}
      </div>

      <div>
        <p className="text-[40px] font-medium leading-none text-text-primary tabular-nums">
          {setup.pumpFlowMlMin}
          <span className="ml-2 text-base font-medium text-text-muted">mL/min</span>
        </p>
        <label
          htmlFor="bench-flow"
          className="mt-4 block text-[13px] font-medium text-text-label"
        >
          Débit de la pompe (mL/min)
        </label>
        <input
          id="bench-flow"
          type="range"
          min={BENCH_FLOW_MIN_ML_MIN}
          max={BENCH_FLOW_MAX_ML_MIN}
          step={BENCH_FLOW_STEP_ML_MIN}
          value={setup.pumpFlowMlMin}
          disabled={locked}
          aria-hidden="true"
          tabIndex={-1}
          className="sr-only"
          readOnly
        />
        <Slider
          min={BENCH_FLOW_MIN_ML_MIN}
          max={BENCH_FLOW_MAX_ML_MIN}
          step={BENCH_FLOW_STEP_ML_MIN}
          value={[setup.pumpFlowMlMin]}
          disabled={locked}
          onValueChange={([value]) => onChange({ ...setup, pumpFlowMlMin: value })}
          aria-label="Débit"
          className="mt-2"
        />
        <div className="mt-1 flex justify-between text-xs text-text-muted">
          <span>{BENCH_FLOW_MIN_ML_MIN} mL/min</span>
          <span>{BENCH_FLOW_MAX_ML_MIN} mL/min</span>
        </div>
      </div>

      <fieldset disabled={locked}>
        <legend className="text-[13px] font-medium text-text-label">
          Rétrécissement contrôlé
        </legend>
        <ToggleGroup
          type="single"
          value={String(setup.clampStenosisPct)}
          disabled={locked}
          aria-hidden={locked}
          aria-label="Rétrécissement contrôlé"
          onValueChange={(value) => {
            if (value !== "") onChange({ ...setup, clampStenosisPct: Number(value) as ClampStenosisPct });
          }}
          className="mt-2"
        >
          {BENCH_CLAMP_OPTIONS.map((pct: ClampStenosisPct) => (
            <ToggleGroupItem key={pct} value={String(pct)} role="button">{pct} %</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      {!locked ? (
        <PillButton
          type="button"
          onClick={onInitialize}
          isLoading={isInitializing}
          className="self-start"
        >
          Initialiser le banc
        </PillButton>
      ) : null}
    </Card>
  );
}
