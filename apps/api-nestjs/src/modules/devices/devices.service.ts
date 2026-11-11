import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { MeasurementSource, Prisma, RejectReason, SyncState } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ConfigService } from '../config/config.service.js';
import { parseCaptureHeader } from '../measurements/dsp.client.js';
import { MeasurementsService } from '../measurements/measurements.service.js';
import { serializeMeasurementResult } from '../measurements/measurement.serializer.js';
import { DeviceCalibrationDto, DeviceSyncDto, DeviceSyncItemDto } from './devices.dto.js';

// Default calibration acceptance tolerance in %. Configuration, not a clinical value.
// "à calibrer au banc" (canonical specification); a ConfigVersion key calibrationTolerancePct overrides it.
export const CALIBRATION_TOLERANCE_PCT_DEFAULT = 3.0;

interface UserContext { sub: string; role: string }

export interface SyncItemResult {
  idempotencyKey: string;
  state: 'SYNCED' | 'FAILED' | 'SYNCING';
  error: string | null;
  measurement?:ReturnType<typeof serializeMeasurementResult>;
}

interface DeviceSummaryInput {
  id: string;
  syncQueueItems: { id: string }[];
  measurements: { patientId: string | null }[];
  [key: string]: unknown;
}

function errorCode(error: unknown): string {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    if (typeof body === 'object' && body !== null) {
      const code = (body as { code?: string }).code;
      if (code) return String(code);
    }
    return 'SYNC_ITEM_FAILED';
  }
  return 'SYNC_ITEM_FAILED';
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly configService: ConfigService,
    private readonly measurements: MeasurementsService,
  ) {}

  async list() {
    const devices = await this.prisma.device.findMany({
      orderBy: { serialNumber: 'asc' },
      include: {
        syncQueueItems: { where: { state: SyncState.FAILED }, select: { id: true } },
        measurements: { select: { patientId: true } },
      },
    });
    return this.toSummaries(devices as unknown as DeviceSummaryInput[]);
  }

  async get(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) {
      throw new NotFoundException({ code: 'DEVICE_UNKNOWN', message_fr: 'Appareil inconnu', retryable: false });
    }
    return device;
  }

  async getAndAudit(id: string, user: UserContext) {
    const device = await this.get(id);
    await this.audit.write({
      actorId: user.sub,
      action: 'DEVICE_VIEWED',
      entity: 'Device',
      entityId: device.id,
    });
    const summary = (await this.list()).find((item) => item.id === device.id);
    if (!summary) throw new NotFoundException({ code: 'DEVICE_UNKNOWN', message_fr: 'Appareil inconnu', retryable: false });
    return summary;
  }

  private toSummaries(devices: DeviceSummaryInput[]) {
    const devicesByPatient = new Map<string, Set<string>>();
    for (const device of devices) {
      for (const measurement of device.measurements) {
        if (!measurement.patientId) continue;
        const deviceIds = devicesByPatient.get(measurement.patientId) ?? new Set<string>();
        deviceIds.add(device.id);
        devicesByPatient.set(measurement.patientId, deviceIds);
      }
    }

    return devices.map((device) => {
      const { syncQueueItems, measurements, ...summary } = device;
      const patients = new Set(measurements.flatMap(({ patientId }) => patientId ? [patientId] : []));
      const crossDevicePatients = [...patients].filter((patientId) => (devicesByPatient.get(patientId)?.size ?? 0) > 1).length;
      return {
        ...summary,
        failedCount: syncQueueItems.length,
        continuity: { uniquePatients: patients.size, crossDevicePatients },
      };
    });
  }

  async calibrate(id: string, dto: DeviceCalibrationDto, user: UserContext) {
    const device = await this.get(id);

    const activeConfig = await this.configService.getActive();
    const values = activeConfig.values as Record<string, unknown>;
    const configured = typeof values.calibrationTolerancePct === 'number' && Number.isFinite(values.calibrationTolerancePct)
      ? values.calibrationTolerancePct
      : CALIBRATION_TOLERANCE_PCT_DEFAULT;
    const gain = device.calibrationGain;
    if (gain > 0 && Math.abs(dto.calibrationGain - gain) / gain > configured / 100) {
      throw new BadRequestException({
        code: 'CALIBRATION_OUT_OF_TOLERANCE',
        message_fr: 'Écart d’étalonnage hors tolérance, refaites la mesure au banc',
        retryable: false,
        field: 'calibrationGain',
      });
    }

    const updated = await this.prisma.device.update({
      where: { id: device.id },
      data: {
        calibrationGain: dto.calibrationGain,
        calibrationOffsetRms: 0,
      },
    });
    await this.audit.write({
      actorId: user.sub,
      action: 'DEVICE_CALIBRATED',
      entity: 'Device',
      entityId: device.id,
      before: { calibrationGain: device.calibrationGain },
      after: { calibrationGain: dto.calibrationGain, reason: dto.reason, configVersion: activeConfig.id },
    });
    const summary = (await this.list()).find((item) => item.id === updated.id);
    return summary ?? updated;
  }

  async sync(dto: DeviceSyncDto, user: UserContext) {
    if (dto.items.length > 50) {
      throw new BadRequestException({
        code: 'SYNC_BATCH_TOO_LARGE',
        message_fr: 'Trop de sessions dans un envoi (maximum 50).',
        retryable: false,
      });
    }

    const now = new Date();
    const device = await this.prisma.device.findUnique({ where: { serialNumber: dto.deviceSerial } });

    let syncedCount = 0;
    let failedCount = 0;
    const results: SyncItemResult[] = [];

    for (const item of dto.items) {
      let queueId: string | undefined;
      try {
        if (device) {
          const queueItem = await this.prisma.syncQueueItem.upsert({
            where: { idempotencyKey: item.idempotencyKey },
            create: {
              deviceId: device.id,
              idempotencyKey: item.idempotencyKey,
              state: SyncState.SYNCING,
              attempts: 1,
              payload: item as unknown as Prisma.InputJsonValue,
            },
            update: {
              state: SyncState.SYNCING,
              attempts: { increment: 1 },
              payload: item as unknown as Prisma.InputJsonValue,
              lastError: null,
            },
            select: { id: true },
          });
          queueId = queueItem.id;
        }
        const result = await this.syncOne(item, device, user);
        if (queueId) {
          await this.prisma.syncQueueItem.update({
            where: { id: queueId },
            data: { state: result.state, lastError: result.error },
          });
        }
        results.push(result);
        if (result.state === 'SYNCED') syncedCount += 1;
        else failedCount += 1;
      } catch (error) {
        const result: SyncItemResult = {
          idempotencyKey: item.idempotencyKey,
          state: 'FAILED',
          error: errorCode(error),
        };
        if (queueId) {
          await this.prisma.syncQueueItem.update({
            where: { id: queueId },
            data: { state: SyncState.FAILED, lastError: result.error },
          });
        }
        results.push(result);
        failedCount += 1;
      }
    }

    if (device) {
      try {
        await this.prisma.device.update({
          where: { id: device.id },
          data: {
            lastSeenAt: now,
            lastSyncAt: now,
            ...(dto.batteryPct === undefined ? {} : { lastBatteryPct: dto.batteryPct }),
          },
        });
      } catch {
        // The device row may have been removed mid-batch: sync results still stand.
      }
    }

    return { syncedCount, failedCount, results };
  }

  async retry(id: string, user: UserContext): Promise<SyncItemResult> {
    const queueItem = await this.prisma.syncQueueItem.findUnique({ where: { id } });
    if (!queueItem) {
      throw new NotFoundException({ code: 'SYNC_ITEM_UNKNOWN', message_fr: 'Élément de synchronisation introuvable', retryable: false });
    }
    if (queueItem.state !== SyncState.FAILED) {
      return { idempotencyKey: queueItem.idempotencyKey, state: queueItem.state as SyncItemResult['state'], error: queueItem.lastError };
    }

    const claimed = await this.prisma.syncQueueItem.updateMany({
      where: { id, state: SyncState.FAILED },
      data: { state: SyncState.SYNCING, attempts: { increment: 1 } },
    });
    if (claimed.count === 0) {
      const current = await this.prisma.syncQueueItem.findUnique({ where: { id } });
      if (!current) throw new NotFoundException({ code: 'SYNC_ITEM_UNKNOWN', message_fr: 'Élément de synchronisation introuvable', retryable: false });
      return { idempotencyKey: current.idempotencyKey, state: current.state as SyncItemResult['state'], error: current.lastError };
    }

    const item = queueItem.payload as unknown as DeviceSyncItemDto;
    const device = await this.prisma.device.findUnique({ where: { id: queueItem.deviceId } });
    const result = await this.syncOne(item, device, user);
    await this.prisma.syncQueueItem.update({
      where: { id },
      data: { state: result.state, lastError: result.error },
    });
    if (device) {
      await this.prisma.device.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date(), lastSyncAt: new Date() },
      });
    }
    return result;
  }

  private async syncOne(item: DeviceSyncItemDto, device: { id: string; calibrationGain: number } | null, user: UserContext): Promise<SyncItemResult> {
    try {
      if (!device) {
        return { idempotencyKey: item.idempotencyKey, state: 'FAILED', error: 'DEVICE_UNKNOWN' };
      }

      const raw = Buffer.from(item.raw_b64, 'base64');
      const header = parseCaptureHeader(raw);

      const patient = await this.prisma.patientPseudo.findUnique({ where: { idPseudo: item.patient } });
      if (!patient) {
        return { idempotencyKey: item.idempotencyKey, state: 'FAILED', error: 'PATIENT_UNKNOWN' };
      }

      let row = await this.prisma.measurement.findUnique({ where: { idempotencyKey: item.idempotencyKey } });
      if (!row) {
        row = await this.reserveRow(item, header, patient.id, device, user);
      }

      const processed = row.cleanDurationSec > 0 || row.rejectReason !== RejectReason.NONE;
      if (!processed) {
        // A previous attempt stored the capture but never analysed it: re-run the
        // pipeline on the same row instead of creating a duplicate session.
        await this.measurements.uploadRaw(row.id, raw, user);
        row = await this.prisma.measurement.findUniqueOrThrow({ where: { id: row.id } });
      }

      return {
        idempotencyKey: item.idempotencyKey,
        state: 'SYNCED',
        error: null,
        measurement: serializeMeasurementResult(row),
      };
    } catch (error) {
      return { idempotencyKey: item.idempotencyKey, state: 'FAILED', error: errorCode(error) };
    }
  }

  private async reserveRow(
    item: DeviceSyncItemDto,
    header: { durationSec: number; avgPressureKpa: number },
    patientId: string,
    device: { id: string; calibrationGain: number },
    user: UserContext,
  ) {
    try {
      return await this.prisma.measurement.create({
        data: {
          idempotencyKey: item.idempotencyKey,
          source: MeasurementSource.PATIENT,
          deviceId: device.id,
          patientId,
          operatorId: user.sub,
          captureDurationSec: header.durationSec,
          cleanDurationSec: 0,
          avgPressureKpa: header.avgPressureKpa,
          artifactRatioPct: 0,
          deviceGain: device.calibrationGain,
          ...(item.capturedAt ? { recordedAt: new Date(item.capturedAt) } : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // A concurrent or earlier attempt already reserved this key: the capture
        // is not duplicated, the existing row carries it.
        const row = await this.prisma.measurement.findUnique({ where: { idempotencyKey: item.idempotencyKey } });
        if (!row) {
          throw new BadRequestException({
            code: 'SYNC_RACE_LOST',
            message_fr: 'Séance déjà synchronisée, réessayez la synchronisation',
            retryable: true,
          });
        }
        return row;
      }
      throw error;
    }
  }
}
