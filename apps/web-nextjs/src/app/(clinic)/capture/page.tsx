import { Suspense } from "react";
import { connection } from "next/server";
import { PageTitle } from "@/components/shell/page-title";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { CaptureClient } from "@/features/capture/ui/capture-client";
import { toDeviceInfo, toPatientSummary } from "@/features/capture/data/capture-sources";
import { getDevices } from "@/features/devices/data/devices-api";
import { getPatients } from "@/features/patients/data/patients-api";
import { CANONICAL_PRESSURE_THRESHOLDS } from "@/components/ui/pressure-gauge";

export default function CapturePage() {
  return (
    <div className="space-y-6">
      <header>
        <PageTitle
          first="Acquisition"
          rest="du thrill"
          subtitle="Mesure de 25 s, sans comprimer la FAV"
        />
      </header>

      <Suspense fallback={<PageSkeleton />}>
        <CaptureData />
      </Suspense>
    </div>
  );
}

/** Real patients and the registered device come from the API; if it is down the screen still opens, with empty lists. */
async function CaptureData() {
  await connection();
  const [patients, devices] = await Promise.all([
    getPatients().catch(() => []),
    getDevices().catch(() => []),
  ]);
  const device = devices[0] ? toDeviceInfo(devices[0]) : null;
  return (
    <CaptureClient
      pressureThresholds={CANONICAL_PRESSURE_THRESHOLDS}
      initialPatients={patients.map(toPatientSummary)}
      initialDevice={device}
    />
  );
}
