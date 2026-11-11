import { Suspense } from "react";
import { connection } from "next/server";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import {
  getActiveClinicalSettings,
  getClinicalSettingsIdentity,
  getClinicalThresholds,
} from "@/features/settings/data/clinical-settings-api";
import { ClinicalSettings } from "@/features/settings/ui/clinical-settings";
import {
  approveClinicalThresholdAction,
  proposeClinicalThresholdAction,
} from "./actions";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClinicalSettingsData />
    </Suspense>
  );
}

async function ClinicalSettingsData() {
  await connection();
  const identity = await getClinicalSettingsIdentity();
  const canAccess = identity.role === "NEPHROLOGIST" || identity.role === "ADMIN";
  const active = canAccess ? await getActiveClinicalSettings() : null;

  return (
    <ClinicalSettings
      role={identity.role}
      userId={identity.userId}
      activeVersion={active?.version ?? null}
      activeDate={active?.publishedAt ?? null}
      thresholds={getClinicalThresholds(active)}
      onPropose={proposeClinicalThresholdAction}
      onApprove={approveClinicalThresholdAction}
    />
  );
}
