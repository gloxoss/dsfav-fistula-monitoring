import { Suspense } from "react";
import { connection } from "next/server";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { BenchHistoryPage, type BenchHistoryRow } from "@/features/bench-history/bench-history-page";
import { getBenchHistory } from "@/features/bench-history/data/bench-history-api";

export default function BenchHistoryRoute() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BenchHistoryData />
    </Suspense>
  );
}

async function BenchHistoryData() {
  await connection();
  let rows: BenchHistoryRow[] = [];
  let unavailable = false;
  try {
    rows = await getBenchHistory();
  } catch {
    unavailable = true;
  }
  return <BenchHistoryPage rows={rows} unavailable={unavailable} />;
}
