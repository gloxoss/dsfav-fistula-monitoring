import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertStatus, MeasurementSource, MeasurementState, Prisma, RejectReason } from '@prisma/client';
import { CLINICAL_DISCLAIMER } from '../../common/constants.js';
import { PrismaService } from '../../common/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BaselineService } from '../baseline/baseline.service.js';
import { ConfigService } from '../config/config.service.js';
import { DspClient, DspResult, parseCaptureHeader } from './dsp.client.js';
import { serializeMeasurementResult } from './measurement.serializer.js';
import { CreateMeasurementDto } from './measurements.dto.js';

interface UserContext { sub: string; role: string }

function configNumbers(values: Prisma.JsonValue): Record<string, number> {
  if (!values || Array.isArray(values) || typeof values !== 'object') {
    throw new BadRequestException({ code: 'CONFIG_INVALID', message_fr: 'Configuration clinique invalide', retryable: false });
  }
  const input = values as Record<string, unknown>;
  const required = ['thresholdSigma', 'consecutiveAlerts', 'pressureMinKpa', 'pressureMaxKpa', 'motionThresholdG', 'cleanTimeMinSec', 'stdFloorPct'];
  const config: Record<string, number> = {};
  for (const key of required) {
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key])) {
      throw new BadRequestException({ code: 'CONFIG_INVALID', message_fr: `Paramètre clinique invalide : ${key}`, retryable: false });
    }
    config[key] = input[key];
  }
  return config;
}

@Injectable()
export class MeasurementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly baselineService: BaselineService,
    private readonly dspClient: DspClient,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateMeasurementDto, user: UserContext) {
    const source = dto.source ?? MeasurementSource.PATIENT;
    if (source === MeasurementSource.PATIENT && user.role !== 'NURSE') {
      throw new ForbiddenException({ code: 'ROLE_FORBIDDEN', message_fr: 'Seul un infirmier peut démarrer une mesure patient', retryable: false });
    }
    if (source === MeasurementSource.BENCH && user.role !== 'INTERN') {
      throw new ForbiddenException({ code: 'ROLE_FORBIDDEN', message_fr: 'Le banc est réservé à la formation', retryable: false });
    }
    if (source === MeasurementSource.PATIENT && !dto.idPseudo) {
      throw new BadRequestException({ code: 'PATIENT_REQUIRED', message_fr: 'Un identifiant pseudonymisé est requis', retryable: false, field: 'idPseudo' });
    }
    const device = await this.prisma.device.findUnique({ where: { id: dto.deviceId } });
    if (!device) throw new NotFoundException({ code: 'DEVICE_UNKNOWN', message_fr: 'Appareil inconnu', retryable: false });
    let patientId: string | null = null;
    if (source === MeasurementSource.PATIENT) {
      const patient = await this.prisma.patientPseudo.findUnique({ where: { idPseudo: dto.idPseudo! } });
      if (!patient) throw new NotFoundException({ code: 'PATIENT_UNKNOWN', message_fr: 'Patient inconnu', retryable: false });
      patientId = patient.id;
    }
    const row = await this.prisma.measurement.create({
      data: {
        source,
        patientId,
        deviceId: device.id,
        operatorId: user.sub,
        rejectReason: RejectReason.NONE,
        captureDurationSec: 0,
        cleanDurationSec: 0,
        avgPressureKpa: 0,
        artifactRatioPct: 0,
        deviceGain: device.calibrationGain,
      },
    });
    return { measurementId: row.id, state: MeasurementState.INIT, disclaimer: CLINICAL_DISCLAIMER };
  }

  async uploadRaw(measurementId: string, raw: Buffer, user: UserContext) {
    const header = parseCaptureHeader(raw);
    const existing = await this.prisma.measurement.findUnique({
      where: { id: measurementId },
      include: { device: true, patient: true },
    });
    if (!existing) throw new NotFoundException({ code: 'MEASUREMENT_UNKNOWN', message_fr: 'Séance inconnue', retryable: false });
    if (existing.operatorId !== user.sub) throw new BadRequestException({ code: 'MEASUREMENT_OWNER', message_fr: 'Cette séance appartient à un autre opérateur', retryable: false });
    if (existing.source === MeasurementSource.BENCH) {
      const bench = await this.prisma.benchSession.findUnique({ where: { measurementId } });
      if (!bench?.palpationLockedAt) {
        throw new ForbiddenException({ code: 'PALPATION_REQUIRED', message_fr: 'Enregistrez la palpation avant de révéler la mesure objective', retryable: false });
      }
    }

    // Preserve the upload before contacting the DSP so a timeout never loses the attempt.
    await this.prisma.measurement.update({
      where: { id: measurementId },
      data: {
        state: MeasurementState.UPLOADED,
        raw: Uint8Array.from(raw),
        captureDurationSec: header.durationSec,
        avgPressureKpa: header.avgPressureKpa,
        deviceGain: existing.device.calibrationGain,
      },
    });

    const activeConfig = await this.configService.getActive();
    const config = configNumbers(activeConfig.values);
    const baselineRow = existing.patient?.baselineLocked
      ? await this.prisma.baselineVersion.findFirst({ where: { patientId: existing.patient.id, active: true }, orderBy: { lockedAt: 'desc' } })
      : null;
    const baseline = baselineRow
      ? {
          rms: baselineRow.rmsMean, rms_std: baselineRow.rmsStd,
          ratio: baselineRow.ratioMean, ratio_std: baselineRow.ratioStd,
          dominant_hz: baselineRow.fpeakMean, dominant_hz_std: baselineRow.fpeakStd,
        }
      : this.baselineFromPatient(existing.patient?.baselineVector ?? null);
    const dsp = await this.dspClient.process(raw, header, config, baseline, existing.device.calibrationGain, baselineRow !== null);
    const status = this.toStatus(dsp.status);
    const rejectReason = dsp.reject_reason ? this.toRejectReason(dsp.reject_reason) : RejectReason.NONE;
    const totalEpochs = Math.max(1, Math.ceil(header.durationSec));
    const artifactRatioPct = (dsp.artifact_epochs.length / totalEpochs) * 100;
    await this.prisma.measurement.update({
      where: { id: measurementId },
      data: {
        state: MeasurementState.ANALYSED,
        cleanDurationSec: dsp.clean_seconds,
        artifactRatioPct,
        pressureCompliant: rejectReason !== RejectReason.PRESSURE,
        configVersionId: activeConfig.id,
        status,
        rejectReason,
        rmsValue: dsp.rms,
        peakAmplitude: dsp.p2p,
        dominantFreqHz: dsp.dominant_hz,
        highLowEnergyRatio: dsp.ratio,
        baselineDeviationScore: dsp.deviation,
        spectrogramJson: dsp.stft as Prisma.InputJsonValue,
        aiOpinion: dsp.aiOpinion as Prisma.InputJsonValue | undefined,
      },
    });
    await this.baselineService.finalizeMeasurement(measurementId, user.sub, status, config.consecutiveAlerts);
    const result = await this.prisma.measurement.findUniqueOrThrow({ where: { id: measurementId } });
    return serializeMeasurementResult(result, dsp);
  }

  async abandon(measurementId: string, reason: string, user: UserContext) {
    const row = await this.prisma.measurement.findUnique({ where: { id: measurementId } });
    if (!row) throw new NotFoundException({ code: 'MEASUREMENT_UNKNOWN', message_fr: 'Séance inconnue', retryable: false });
    if (row.operatorId !== user.sub) throw new BadRequestException({ code: 'MEASUREMENT_OWNER', message_fr: 'Cette séance appartient à un autre opérateur', retryable: false });
    await this.audit.write({ actorId: user.sub, action: 'MEASUREMENT_ABANDONED', entity: 'Measurement', entityId: row.id, after: { reason } });
    await this.prisma.measurement.update({ where: { id: row.id }, data: { state: MeasurementState.ABANDONED } });
    return { measurementId: row.id, status: 'ABANDONED', disclaimer: CLINICAL_DISCLAIMER };
  }

  async getQueue(status?: AlertStatus, deviceId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = await this.prisma.measurement.findMany({
      where: {
        state: MeasurementState.ANALYSED,
        // Triage queue = patient measurements only; bench (phantom) sessions have no patient.
        source: 'PATIENT',
        patientId: { not: null },
        recordedAt: { gte: today },
        ...(status ? { status } : {}),
        ...(deviceId ? { deviceId } : {}),
      },
      include: { patient: { select: { idPseudo: true } } },
      orderBy: [{ status: 'asc' }, { recordedAt: 'desc' }],
    });
    return rows.map((row) => ({
      measurementId: row.id,
      idPseudo: row.patient?.idPseudo ?? null,
      deviceId: row.deviceId,
      operatorId: row.operatorId,
      status: row.status,
      recordedAt: row.recordedAt,
      disclaimer: CLINICAL_DISCLAIMER,
    }));
  }

  async getDetail(measurementId: string) {
    const row = await this.prisma.measurement.findUnique({
      where: { id: measurementId },
      include: { patient: { select: { idPseudo: true } } },
    });
    if (!row) throw new NotFoundException({ code: 'MEASUREMENT_UNKNOWN', message_fr: 'Séance inconnue', retryable: false });
    return {
      patientId: row.patientId,
      idPseudo: row.patient?.idPseudo ?? null,
      deviceId: row.deviceId,
      operatorId: row.operatorId,
      recordedAt: row.recordedAt,
      durationSec: row.captureDurationSec,
      cleanDurationSec: row.cleanDurationSec,
      avgPressureKpa: row.avgPressureKpa,
      ...serializeMeasurementResult(row),
    };
  }

  private baselineFromPatient(value: Prisma.JsonValue | null | undefined): Record<string, number> | null {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    const item = value as Record<string, unknown>;
    const number = (preferred: string, fallback: string) => {
      const found = item[preferred] ?? item[fallback];
      return typeof found === 'number' ? found : undefined;
    };
    const rms = number('rms', 'rms_mean');
    const ratio = number('ratio', 'stenosis_ratio_mean');
    const dominantHz = number('dominant_hz', 'fpeak_mean');
    if (rms === undefined || ratio === undefined || dominantHz === undefined) return null;
    const output: Record<string, number> = { rms, ratio, dominant_hz: dominantHz };
    const rmsStd = number('rms_std', 'rms_std');
    const ratioStd = number('ratio_std', 'stenosis_ratio_std');
    const dominantStd = number('dominant_hz_std', 'fpeak_std');
    if (rmsStd !== undefined) output.rms_std = rmsStd;
    if (ratioStd !== undefined) output.ratio_std = ratioStd;
    if (dominantStd !== undefined) output.dominant_hz_std = dominantStd;
    return output;
  }

  private toStatus(status: DspResult['status']): AlertStatus {
    return status as AlertStatus;
  }

  private toRejectReason(reason: 'ARTIFACT' | 'PRESSURE'): RejectReason {
    return reason as RejectReason;
  }
}
