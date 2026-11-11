import { Suspense } from "react";
import { connection } from "next/server";
import { PageTitle } from "@/components/shell/page-title";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { getQueue } from "@/features/queue/data/queue-api";
import type { ApiQueueItem } from "@/features/queue/model/types";
import { DashboardView } from "@/features/queue/ui/dashboard-view";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageTitle
        first="Tableau"
        rest="de bord"
        subtitle="File de triage du jour et accès rapides"
      />
      <Suspense fallback={<PageSkeleton />}>
        <DashboardData />
      </Suspense>
    </div>
  );
}

async function DashboardData() {
  await connection();

  let queue: ApiQueueItem[] = [];
  let unavailable = false;

  try {
    queue = await getQueue();
  } catch {
    unavailable = true;
  }

  return <DashboardView queue={queue} unavailable={unavailable} />;
}
