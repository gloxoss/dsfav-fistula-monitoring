import { Suspense } from "react";
import { connection } from "next/server";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { AuditLogPage, type AuditViewRow } from "@/features/admin/admin-pages";
import { getAuditEvents } from "@/features/admin/data/admin-api";

export default function AdminAuditRoute() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AuditData />
    </Suspense>
  );
}

async function AuditData() {
  await connection();
  let rows: AuditViewRow[] = [];
  let nextCursor: string | null = null;
  let unavailable = false;
  try {
    const page = await getAuditEvents({ limit: 50 });
    rows = page.items;
    nextCursor = page.nextCursor ?? null;
  } catch {
    unavailable = true;
  }
  return <AuditLogPage rows={rows} nextCursor={nextCursor} unavailable={unavailable} />;
}
