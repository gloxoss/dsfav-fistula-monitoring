import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertStatus, MeasurementState, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { applyPersistenceRule, baselineProgress } from './baseline.logic.js';

type FeatureRow = { rmsValue: number | null; highLowEnergyRatio: number | null; dominantFreqHz: number | null };
const ACCEPTED = [AlertStatus.NORMAL, AlertStatus.TO_CONFIRM, AlertStatus.UNUSUAL_EVOLUTION, AlertStatus.BASELINE_BUILDING];

function featureMean(rows: FeatureRow[], key: keyof FeatureRow): number {
  const values = rows.map((row) => row[key]).filter((value): value is number => value !== null);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function featureStd(rows: FeatureRow[], key: keyof FeatureRow): number {
  const values = rows.map((row) => row[key]).filter((value): value is number => value !== null);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

@Injectable()
export class BaselineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async finalizeMeasurement(measurementId: string, actorId: string, dspStatus: AlertStatus, consecutiveRequired = 2) {
    const measurement = await this.prisma.measurement.findUnique({
      where: { id: measurementId },
      include: { patient: true },
    });
    if (!measurement) throw new NotFoundException();
    if (!measurement.patientId || !measurement.patient) {
      return this.prisma.measurement.update({ where: { id: measurementId }, data: { status: dspStatus } });
    }

    const patient = measurement.patient;
    const latestArchive = await this.prisma.baselineVersion.findFirst({
      where: { patientId: patient.id, active: false, archivedAt: { not: null } },
      orderBy: { archivedAt: 'desc' },
      select: { archivedAt: true },
    });
    const since = latestArchive?.archivedAt;

    if (dspStatus === AlertStatus.REJECTED_QUALITY) {
      return this.prisma.measurement.update({
        where: { id: measurementId },
        data: { status: dspStatus },
      });
    }

    if (patient.baselineLocked) {
      const previous = await this.prisma.measurement.findMany({
        where: {
          patientId: patient.id,
          id: { not: measurementId },
          state: MeasurementState.ANALYSED,
          status: { in: ACCEPTED },
          ...(since ? { recordedAt: { gt: since } } : {}),
        },
        orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }],
        select: { status: true },
      });
      let previousConsecutiveAbove = 0;
      for (const row of previous) {
        if (row.status === AlertStatus.TO_CONFIRM || row.status === AlertStatus.UNUSUAL_EVOLUTION) {
          previousConsecutiveAbove += 1;
        } else {
          break;
        }
      }
      const status = applyPersistenceRule(dspStatus, previousConsecutiveAbove, consecutiveRequired);
      return this.prisma.measurement.update({ where: { id: measurementId }, data: { status } });
    }

    const acceptedCount = await this.prisma.measurement.count({
      where: {
        patientId: patient.id,
        id: { not: measurementId },
        state: MeasurementState.ANALYSED,
        status: { in: ACCEPTED },
        rmsValue: { not: null },
        highLowEnergyRatio: { not: null },
        dominantFreqHz: { not: null },
        ...(since ? { recordedAt: { gt: since } } : {}),
      },
    });
    const progress = baselineProgress(acceptedCount, false, dspStatus);
    await this.prisma.$transaction(async (tx) => {
      await tx.measurement.update({ where: { id: measurementId }, data: { status: progress.status } });
      if (!progress.shouldLock) return;

      const sessions = await tx.measurement.findMany({
        where: {
          patientId: patient.id,
          state: MeasurementState.ANALYSED,
          status: { in: ACCEPTED },
          rmsValue: { not: null },
          highLowEnergyRatio: { not: null },
          dominantFreqHz: { not: null },
          ...(since ? { recordedAt: { gt: since } } : {}),
        },
        orderBy: [{ recordedAt: 'asc' }, { createdAt: 'asc' }],
        take: 3,
        select: { rmsValue: true, highLowEnergyRatio: true, dominantFreqHz: true },
      });
      if (sessions.length < 3 || sessions.some((row) => row.rmsValue === null || row.highLowEnergyRatio === null || row.dominantFreqHz === null)) {
        return;
      }

      const rmsMean = featureMean(sessions, 'rmsValue');
      const ratioMean = featureMean(sessions, 'highLowEnergyRatio');
      const fpeakMean = featureMean(sessions, 'dominantFreqHz');
      const rmsStd = featureStd(sessions, 'rmsValue');
      const ratioStd = featureStd(sessions, 'highLowEnergyRatio');
      const fpeakStd = featureStd(sessions, 'dominantFreqHz');
      await tx.baselineVersion.create({
        data: {
          patientId: patient.id,
          rmsMean,
          rmsStd,
          ratioMean,
          ratioStd,
          fpeakMean,
          fpeakStd,
          lockedById: actorId,
          active: true,
        },
      });
      const vector: Prisma.InputJsonObject = {
        rms: rmsMean,
        rms_std: rmsStd,
        ratio: ratioMean,
        ratio_std: ratioStd,
        dominant_hz: fpeakMean,
        dominant_hz_std: fpeakStd,
      };
      await tx.patientPseudo.update({
        where: { id: patient.id },
        data: { baselineLocked: true, baselineVector: vector },
      });
      await this.audit.write({
        actorId,
        action: 'BASELINE_LOCKED',
        entity: 'BaselineVersion',
        after: { patientId: patient.id, rmsMean, ratioMean, fpeakMean },
      }, tx);
    });
    return this.prisma.measurement.findUniqueOrThrow({ where: { id: measurementId } });
  }

  async rebaseline(idPseudo: string, reason: string, actorId: string) {
    const patient = await this.prisma.patientPseudo.findUnique({ where: { idPseudo } });
    if (!patient) throw new NotFoundException();
    return this.prisma.$transaction(async (tx) => {
      await tx.baselineVersion.updateMany({
        where: { patientId: patient.id, active: true },
        data: { active: false, archivedAt: new Date(), reason },
      });
      await tx.patientPseudo.update({
        where: { id: patient.id },
        data: { baselineLocked: false, baselineVector: Prisma.DbNull },
      });
      await this.audit.write({
        actorId,
        action: 'REBASELINE',
        entity: 'PatientPseudo',
        entityId: patient.id,
        before: { baselineLocked: patient.baselineLocked },
        after: { baselineLocked: false, reason },
      }, tx);
      return { idPseudo, status: AlertStatus.BASELINE_BUILDING, reason };
    });
  }
}
