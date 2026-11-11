import { Suspense } from "react";
import { connection } from "next/server";
import { PageTitle } from "@/components/shell/page-title";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import {
  getActiveClinicalConfig,
  getCalibrationHistory,
  getDevices,
  getSessionRole,
} from "@/features/devices/data/devices-api";
import { resolveDeviceThresholds } from "@/features/devices/model/constants";
import type { ApiDeviceSummary } from "@/features/devices/model/types";
import { DevicesView } from "@/features/devices/ui/devices-view";
import { calibrateDeviceAction } from "./actions";

export default function DevicesPage() {
  return (
    <div className="space-y-6">
      <PageTitle
        first="Flotte DSFAV"
        rest="et synchronisation"
        subtitle="Appareils, batterie et écart de gain de la flotte"
      />
      <Suspense fallback={<PageSkeleton />}>
        <DevicesData />
      </Suspense>
    </div>
  );
}

async function DevicesData() {
  await connection();

  const rolePromise = getSessionRole();
  const configPromise = getActiveClinicalConfig();
  let devices: ApiDeviceSummary[] = [];
  let unavailable = false;

  try {
    devices = await getDevices();
  } catch {
    unavailable = true;
  }

  const [role, config] = await Promise.all([rolePromise, configPromise]);
  const calibrationHistory =
    role === "ADMIN" || role === "NEPHROLOGIST"
      ? await getCalibrationHistory(devices)
      : undefined;

  return (
    <DevicesView
      devices={devices}
      role={role}
      thresholds={resolveDeviceThresholds(config)}
      calibrationHistory={calibrationHistory}
      unavailable={unavailable}
      onCalibrate={calibrateDeviceAction}
    />
  );
}
