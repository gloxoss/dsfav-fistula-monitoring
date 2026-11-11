"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { flexRender } from "@tanstack/react-table";
import {
  getCoreRowModel,
  legacyCreateColumnHelper as createColumnHelper,
  useLegacyTable as useReactTable,
} from "@tanstack/react-table/legacy";
import { Disclaimer } from "@/components/shared/disclaimer";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { ProgressPill } from "@/components/ui/progress-pill";
import {
  batteryStatus,
  formatDeviceName,
  formatLastSeen,
  formatPercent,
  formatSignedPercent,
  gainStatus,
  isGainOutOfTolerance,
  toneBarClass,
  toneTextClass,
} from "../model/format";
import type { ApiDeviceSummary, DevicesViewProps } from "../model/types";
import { CalibrationForm } from "./calibration-form";

export function DevicesView({
  devices,
  role,
  thresholds,
  calibrationHistory,
  unavailable = false,
  onCalibrate,
}: DevicesViewProps) {
  const isAdmin = role === "ADMIN";

  const lowBatteryCount =
    unavailable || thresholds === null
      ? null
      : devices.filter((device) => device.lastBatteryPct <= thresholds.batteryWarnPct).length;

  const gainOutCount =
    unavailable || thresholds === null
      ? null
      : devices.filter((device) =>
          isGainOutOfTolerance(device.calibrationGain, thresholds.gainTolerancePct),
        ).length;

  const totalFailedSessions = devices.reduce(
    (total, device) => total + (device.failedCount ?? 0),
    0,
  );

  const flaggedDevice =
    (thresholds === null
      ? undefined
      : devices.find((device) =>
          isGainOutOfTolerance(device.calibrationGain, thresholds.gainTolerancePct),
        )) ?? devices[0];

  const flaggedOutOfTolerance =
    thresholds !== null &&
    flaggedDevice !== undefined &&
    isGainOutOfTolerance(flaggedDevice.calibrationGain, thresholds.gainTolerancePct);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(devices[0]?.id ?? "");
  const [historyLimit, setHistoryLimit] = useState<number>(10);
  const activeDeviceId = selectedDeviceId || devices[0]?.id || "";

  const deviceHistory = useMemo(() => {
    if (!calibrationHistory || calibrationHistory.length === 0) return [];
    if (!activeDeviceId) return calibrationHistory;
    const matching = calibrationHistory.filter((entry) => entry.entityId === activeDeviceId);
    return matching.length > 0 ? matching : calibrationHistory;
  }, [calibrationHistory, activeDeviceId]);

  const displayedHistory = useMemo(
    () => deviceHistory.slice(0, historyLimit),
    [deviceHistory, historyLimit],
  );

  const tableData = devices;

  const columnHelper = useMemo(() => createColumnHelper<ApiDeviceSummary>(), []);

  const columns = useMemo(
    () => [
      columnHelper.accessor("serialNumber", {
        id: "device",
        header: "Appareil",
        cell: (info) => {
          const device = info.row.original;
          return (
            <div>
              <p className="font-mono text-sm text-text-primary">{device.serialNumber}</p>
              <p className="font-mono text-xs text-text-muted">{device.macAddress}</p>
            </div>
          );
        },
      }),
      columnHelper.accessor("lastBatteryPct", {
        id: "battery",
        header: "Batterie",
        cell: (info) => {
          const device = info.row.original;
          const battery =
            thresholds === null ? null : batteryStatus(device.lastBatteryPct, thresholds);
          if (battery === null) {
            return (
              <>
                <p className="text-sm font-medium text-text-primary">
                  {formatPercent(device.lastBatteryPct)}
                </p>
                <ProgressPill
                  value={device.lastBatteryPct}
                  colorClass="bg-text-muted"
                  className="mt-2 max-w-[160px]"
                />
              </>
            );
          }
          return (
            <>
              <p className={`text-sm font-medium ${toneTextClass(battery.tone)}`}>
                {`${formatPercent(device.lastBatteryPct)} · ${battery.label}`}
              </p>
              <ProgressPill
                value={device.lastBatteryPct}
                colorClass={toneBarClass(battery.tone)}
                className="mt-2 max-w-[160px]"
              />
            </>
          );
        },
      }),
      columnHelper.accessor((row) => row.lastSyncAt ?? row.lastSeenAt, {
        id: "lastSync",
        header: "Dernière synchronisation",
        cell: (info) => {
          const val = info.getValue();
          return (
            <span className="font-tabular text-sm text-text-secondary">
              {formatLastSeen(val) ?? "—"}
            </span>
          );
        },
      }),
      columnHelper.accessor("failedCount", {
        id: "failedItems",
        header: "Éléments en échec",
        cell: (info) => {
          const count = info.getValue() ?? 0;
          return (
            <span
              className={`text-sm font-medium font-tabular ${
                count > 0 ? "text-warning-text font-bold" : "text-text-muted"
              }`}
            >
                {count}
            </span>
          );
        },
      }),
      columnHelper.accessor((row) => row.continuity, {
        id: "continuity",
        header: "Continuité",
        cell: (info) => {
          const continuity = info.getValue();
          if (!continuity) return <span className="text-sm text-text-muted">—</span>;
          return (
            <span className="whitespace-nowrap text-sm text-text-secondary">
              {`${continuity.uniquePatients} patient${
                continuity.uniquePatients === 1 ? "" : "s"
              } · ${continuity.crossDevicePatients} inter-appareils`}
            </span>
          );
        },
      }),
      columnHelper.accessor("calibrationGain", {
        id: "gain",
        header: "Écart de gain",
        cell: (info) => {
          const device = info.row.original;
          const gain =
            thresholds === null ? null : gainStatus(device.calibrationGain, thresholds);
          if (gain === null) {
            return (
              <>
                <p className="font-tabular text-sm font-medium text-text-primary">
                  {formatSignedPercent((device.calibrationGain - 1) * 100)}
                </p>
              </>
            );
          }
          return (
            <p className={`text-sm font-medium ${toneTextClass(gain.tone)}`}>
              {gain.text}
            </p>
          );
        },
      }),
    ],
    [columnHelper, thresholds],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Appareils"
          value={unavailable ? "—" : devices.length}
          caption={unavailable ? "Données indisponibles" : "Unités enregistrées"}
        />
        <MetricCard
          label="Batterie faible"
          value={lowBatteryCount === null ? "—" : lowBatteryCount}
          caption={
            thresholds === null
              ? "Seuil non configuré"
              : `Seuil ${formatPercent(thresholds.batteryWarnPct)}`
          }
        />
        <MetricCard
          label="Gain hors tolérance"
          value={gainOutCount === null ? "—" : gainOutCount}
          caption={
            thresholds === null
              ? "Seuil non configuré"
              : `Tolérance ${formatPercent(thresholds.gainTolerancePct)}`
          }
        />
        <MetricCard
          label="Échecs de synchronisation"
          value={totalFailedSessions === null ? "—" : totalFailedSessions}
          caption={
            totalFailedSessions === null
              ? "État de synchronisation indisponible"
              : "Sessions conservées sur l’appareil"
          }
        />
      </div>

      {thresholds === null ? (
        <Card variant="well" className="space-y-1">
          <p className="text-sm font-medium text-text-primary">Configuration indisponible</p>
          <p className="text-xs text-text-secondary">
            Aucune configuration clinique active ne fournit les seuils de batterie et de gain ;
            aucun seuil n’est appliqué.
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[13px] font-medium tracking-wide text-text-label">Appareils</h2>
            <span className="text-xs text-text-secondary">
              {unavailable
                ? "Flotte indisponible"
                : `${devices.length} unité${devices.length > 1 ? "s" : ""}`}
            </span>
          </div>

          {unavailable ? (
            <div className="space-y-2 rounded-[20px] bg-well p-5">
              <p className="text-sm text-text-primary">Flotte indisponible.</p>
              <Link
                href="/devices"
                className="text-sm font-medium text-primary underline underline-offset-4"
              >
                Recharger la flotte
              </Link>
            </div>
          ) : devices.length === 0 ? (
            <div className="space-y-2 rounded-[20px] bg-well p-5">
              <p className="text-sm text-text-primary">Aucun appareil enregistré.</p>
              <p className="text-xs text-text-secondary">
                Un appareil apparaît ici après son premier appairage au serveur de la clinique.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <caption className="sr-only">Flotte d’appareils DSFAV</caption>
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr
                      key={headerGroup.id}
                      className="text-xs font-medium uppercase tracking-wide text-text-label"
                    >
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} scope="col" className="pb-3 pr-4 font-medium">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-hairline">
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="align-top">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="py-3 pr-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {flaggedDevice ? (
          <Card variant="dark" className="space-y-4 self-start">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
                {flaggedDevice.serialNumber}
              </span>
              <span className="text-xs text-cyan">
                Batterie {formatPercent(flaggedDevice.lastBatteryPct)}
              </span>
            </div>
            <div>
              <p className="text-lg font-medium text-white">Calibration</p>
              <p
                className={
                  flaggedOutOfTolerance ? "text-sm text-warning" : "text-sm text-text-muted"
                }
              >
                {thresholds === null
                  ? "Seuils de calibration indisponibles"
                  : flaggedOutOfTolerance
                    ? "Calibration requise"
                    : "Calibration dans la tolérance"}
              </p>
            </div>
            {isAdmin && onCalibrate ? (
              <CalibrationForm
                deviceId={flaggedDevice.id}
                serialNumber={flaggedDevice.serialNumber}
                action={onCalibrate}
              />
            ) : (
              <p className="text-sm text-text-muted">Réservé à l’administration</p>
            )}
          </Card>
        ) : null}
      </div>

      {isAdmin || role === "NEPHROLOGIST" ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[13px] font-medium tracking-wide text-text-label">
                Historique d’étalonnage
              </h2>
              <span className="text-xs text-text-secondary">
                Traçabilité des calibrations au banc
              </span>
            </div>
            {devices.length > 1 ? (
              <div className="flex items-center gap-2">
                <label htmlFor="device-history-select" className="text-xs text-text-secondary">
                  Appareil :
                </label>
                <select
                  id="device-history-select"
                  aria-label="Appareil sélectionné pour l’historique"
                  value={activeDeviceId}
                  onChange={(event) => {
                    setSelectedDeviceId(event.target.value);
                    setHistoryLimit(10);
                  }}
                  className="rounded-lg border border-hairline bg-surface px-2.5 py-1 text-xs font-mono text-text-primary"
                >
                  {devices.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.serialNumber}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          {deviceHistory.length === 0 ? (
            <p className="text-sm text-text-secondary">
              Aucun historique d’étalonnage disponible pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <caption className="sr-only">Historique d’étalonnage DSFAV</caption>
                  <thead>
                    <tr className="text-xs font-medium uppercase tracking-wide text-text-label">
                      <th scope="col" className="pb-3 pr-4 font-medium">Appareil</th>
                      <th scope="col" className="pb-3 pr-4 font-medium">Date</th>
                      <th scope="col" className="pb-3 pr-4 font-medium">Gain mesuré</th>
                      <th scope="col" className="pb-3 pr-4 font-medium">Motif</th>
                      <th scope="col" className="pb-3 font-medium">Opérateur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {displayedHistory.map((entry) => (
                      <tr key={entry.id} className="align-top">
                        <td className="py-3 pr-4 font-mono text-sm text-text-primary">
                          {devices.find((device) => device.id === entry.entityId)?.serialNumber ??
                            formatDeviceName(entry.entityId)}
                        </td>
                        <td className="py-3 pr-4 font-tabular text-sm text-text-secondary">
                          {formatLastSeen(entry.at) ?? entry.at}
                        </td>
                        <td className="py-3 pr-4 font-tabular text-sm text-text-primary">
                          {entry.after
                            ? formatSignedPercent((entry.after.calibrationGain - 1) * 100)
                            : "—"}
                        </td>
                        <td className="py-3 pr-4 text-sm text-text-primary">
                          {entry.after?.reason ?? "—"}
                        </td>
                        <td className="py-3 font-mono text-xs text-text-secondary">
                          {entry.actorRole}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {deviceHistory.length > historyLimit ? (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setHistoryLimit(deviceHistory.length)}
                    className="rounded-full border border-hairline bg-surface px-4 py-2 text-xs font-medium text-text-primary hover:bg-well"
                  >
                    Voir tout ({deviceHistory.length} étalonnages)
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </Card>
      ) : null}

      <div className="pt-2">
        <Disclaimer />
      </div>
    </div>
  );
}
