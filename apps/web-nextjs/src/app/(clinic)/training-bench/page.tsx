import { PageTitle } from "@/components/shell/page-title";
import { BenchClient } from "@/features/bench/ui/bench-client";
import { resolveBenchDeviceId } from "@/features/bench/model/bench-device";

export default function TrainingBenchPage() {
  const benchDeviceId = resolveBenchDeviceId(process.env.BENCH_DEVICE_ID);

  return (
    <div className="space-y-6">
      <header>
        <PageTitle
          first="Banc d’essai"
          rest="hémodynamique"
          subtitle="Pompe péristaltique · tube silicone · rétrécissement contrôlé"
          actions={
            <>
              <span className="inline-flex items-center rounded-full bg-periwinkle-tint px-4 py-2 text-sm font-medium text-artifact-text">
                Simulation sur banc · pas de donnée patient
              </span>
              <span className="inline-flex items-center rounded-full bg-surface px-4 py-2 text-sm font-medium text-text-secondary">
                Banc n°02
              </span>
            </>
          }
        />
      </header>

      <BenchClient deviceId={benchDeviceId} />
    </div>
  );
}
