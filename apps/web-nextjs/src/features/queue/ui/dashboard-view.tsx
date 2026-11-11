import Link from "next/link";
import { Disclaimer } from "@/components/shared/disclaimer";
import { Card } from "@/components/ui/card";
import type { ApiQueueItem } from "../model/types";
import { QueueBoard } from "./queue-board";

export interface DashboardViewProps {
  queue: ApiQueueItem[];
  unavailable?: boolean;
}

export function DashboardView({ queue, unavailable = false }: DashboardViewProps) {
  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-medium tracking-wide text-text-label">
            Patients à examiner
          </h2>
          <span className="text-xs text-text-secondary">File de triage du jour</span>
        </div>

        {unavailable ? (
          <div className="space-y-2 rounded-[20px] bg-well p-5">
            <p className="text-sm text-text-primary">Le tableau n’a pas pu être chargé.</p>
            <Link href="/dashboard" className="text-sm font-medium text-primary underline underline-offset-4">
              Réessayer
            </Link>
          </div>
        ) : (
          <QueueBoard queue={queue} />
        )}
      </Card>

      <div className="pt-2">
        <Disclaimer />
      </div>
    </div>
  );
}
