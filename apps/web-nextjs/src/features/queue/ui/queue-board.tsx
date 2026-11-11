"use client";

import { useState } from "react";
import type { ApiQueueItem, ClinicalStatus } from "../model/types";
import { QueueSummary } from "./queue-summary";
import { QueueTable } from "./queue-table";

export interface QueueBoardProps {
  queue: ApiQueueItem[];
}

/** Summary tiles and the queue table share one status filter: a tile click filters the table. */
export function QueueBoard({ queue }: QueueBoardProps) {
  const [statusFilter, setStatusFilter] = useState<ClinicalStatus | "ALL">("ALL");
  return (
    <div className="space-y-4">
      <QueueSummary queue={queue} active={statusFilter} onSelect={setStatusFilter} />
      <QueueTable queue={queue} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />
    </div>
  );
}
