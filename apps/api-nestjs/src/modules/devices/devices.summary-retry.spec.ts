import 'reflect-metadata';
import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../../common/roles.guard.js';
import { ROLES_KEY } from '../../common/roles.decorator.js';
import { DevicesService } from './devices.service.js';
import { SyncQueueController } from './sync-queue.controller.js';

describe('device sync summary and retry', () => {
  it('[AUTHZ-MATRIX] sync retry route is nurse-only', () => {
    const handler = Object.getOwnPropertyDescriptor(SyncQueueController.prototype, 'retry')!.value as (...args: never[]) => unknown;
    const guard = new RolesGuard(new Reflector());
    const context = {
      getHandler: () => handler,
      getClass: () => SyncQueueController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.INTERN } }) }),
    } as unknown as ExecutionContext;

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.NURSE]);
    expect(guard.canActivate.bind(guard, context)).toThrow(ForbiddenException);
  });

  it('[UC12] device summary exposes lastSyncAt, failedCount, and cross-device continuity', async () => {
    const lastSyncAt = new Date('2026-11-08T12:00:00Z');
    const devices = [
      {
        id: 'd1', serialNumber: 'UNIT-1', lastSyncAt,
        syncQueueItems: [{ id: 'failed' }],
        measurements: [{ patientId: 'p1' }, { patientId: 'p2' }],
      },
      {
        id: 'd2', serialNumber: 'UNIT-2', lastSyncAt: null,
        syncQueueItems: [],
        measurements: [{ patientId: 'p1' }, { patientId: null }],
      },
    ];
    const prisma = { device: { findMany: jest.fn(async () => devices) } };
    const service = new DevicesService(prisma as never, {} as never, {} as never, {} as never);

    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({
        id: 'd1', lastSyncAt, failedCount: 1,
        continuity: { uniquePatients: 2, crossDevicePatients: 1 },
      }),
      expect.objectContaining({
        id: 'd2', lastSyncAt: null, failedCount: 0,
        continuity: { uniquePatients: 1, crossDevicePatients: 1 },
      }),
    ]);
  });

  it('[NO-LOSS] retry of a FAILED sync item processes the reserved measurement once', async () => {
    let queueState = 'FAILED';
    const queueItem = {
      id: 'queue-id', deviceId: 'device-id', idempotencyKey: 'capture-key', state: 'FAILED',
      attempts: 1, payload: {
        idempotencyKey: 'capture-key', patient: 'PT-1',
        raw_b64: (() => {
          const raw = Buffer.alloc(32);
          raw.write('DSFV', 0, 'ascii');
          raw.writeUInt16LE(1, 4);
          raw.writeUInt16LE(10, 6);
          raw.writeUInt16LE(10, 8);
          raw.writeUInt32LE(1, 10);
          raw.writeUInt32LE(1, 14);
          return raw.toString('base64');
        })(),
      },
    };
    const queueUpdateMany = jest.fn().mockImplementation(async () => {
      if (queueState !== 'FAILED') return { count: 0 };
      queueState = 'SYNCING';
      return { count: 1 };
    });
    const row = {
      id: 'measurement-id', state: 'INIT', cleanDurationSec: 0, rejectReason: 'NONE', status: null,
      artifactRatioPct: 0, avgPressureKpa: 5, rmsValue: null, peakAmplitude: null,
      dominantFreqHz: null, highLowEnergyRatio: null, baselineDeviationScore: null, spectrogramJson: null,
    };
    const prisma = {
      syncQueueItem: {
        findUnique: jest.fn().mockImplementation(async () => ({ ...queueItem, state: queueState })),
        updateMany: queueUpdateMany,
        update: jest.fn().mockImplementation(async () => {
          queueState = 'SYNCED';
          return { ...queueItem, state: queueState };
        }),
      },
      device: {
        findUnique: jest.fn(async () => ({ id: 'device-id', calibrationGain: 1 })),
        update: jest.fn(async () => ({})),
      },
      measurement: {
        findUnique: jest.fn(async () => row),
        findUniqueOrThrow: jest.fn(async () => ({ ...row, cleanDurationSec: 25, status: 'NORMAL' })),
      },
      patientPseudo: { findUnique: jest.fn(async () => ({ id: 'patient-id' })) },
    };
    const measurements = { uploadRaw: jest.fn(async () => undefined) };
    const service = new DevicesService(prisma as never, {} as never, {} as never, measurements as never);

    await service.retry('queue-id', { sub: 'nurse-id', role: 'NURSE' });
    await service.retry('queue-id', { sub: 'nurse-id', role: 'NURSE' });

    expect(measurements.uploadRaw).toHaveBeenCalledTimes(1);
    expect(queueUpdateMany).toHaveBeenCalledTimes(1);
  });
});
