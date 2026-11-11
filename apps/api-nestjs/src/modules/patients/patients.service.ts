import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service.js';
import { CLINICAL_DISCLAIMER } from '../../common/constants.js';
import { CreatePatientDto, RebaselineDto, CreateNoteDto, CreateFollowUpIntentDto } from './patients.dto.js';
import { serializeHistory } from './history.serializer.js';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const patients = await this.prisma.patientPseudo.findMany({
      include: {
        measurements: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
          select: {
            status: true,
            recordedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return patients.map((p) => {
      const latest = p.measurements[0];
      return {
        id: p.id,
        idPseudo: p.idPseudo,
        fistulaType: p.fistulaType,
        armSide: p.armSide,
        baselineLocked: p.baselineLocked,
        lastStatus: latest ? latest.status : null,
        lastMeasurementAt: latest ? latest.recordedAt : null,
        createdAt: p.createdAt,
      };
    });
  }

  async findByIdPseudo(idPseudo: string) {
    const patient = await this.prisma.patientPseudo.findUnique({
      where: { idPseudo },
    });

    if (!patient) {
      throw new NotFoundException({
        code: 'PATIENT_UNKNOWN',
        message_fr: 'Patient inconnu, veuillez confirmer la création',
        retryable: false,
      });
    }

    return {
      id: patient.id,
      idPseudo: patient.idPseudo,
      fistulaType: patient.fistulaType,
      armSide: patient.armSide,
      baselineLocked: patient.baselineLocked,
      baselineVector: patient.baselineVector,
      createdAt: patient.createdAt,
    };
  }

  async create(dto: CreatePatientDto) {
    const existing = await this.prisma.patientPseudo.findUnique({
      where: { idPseudo: dto.idPseudo },
    });

    if (existing) {
      throw new ConflictException({
        code: 'PATIENT_ALREADY_EXISTS',
        message_fr: 'Ce patient avec cet identifiant existe déjà',
        retryable: false,
      });
    }

    const created = await this.prisma.patientPseudo.create({
      data: {
        idPseudo: dto.idPseudo,
        fistulaType: dto.fistulaType,
        armSide: dto.armSide,
        baselineLocked: false,
        baselineVector: Prisma.DbNull,
      },
    });

    return {
      id: created.id,
      idPseudo: created.idPseudo,
      fistulaType: created.fistulaType,
      armSide: created.armSide,
      baselineLocked: created.baselineLocked,
      baselineVector: created.baselineVector,
      createdAt: created.createdAt,
    };
  }

  async getHistory(idPseudo: string) {
    const patient = await this.findByIdPseudo(idPseudo);

    const measurements = await this.prisma.measurement.findMany({
      where: { patientId: patient.id, state: 'ANALYSED' },
      orderBy: { recordedAt: 'desc' },
      select: {
        id: true,
        recordedAt: true,
        captureDurationSec: true,
        cleanDurationSec: true,
        avgPressureKpa: true,
        status: true,
        rejectReason: true,
        rmsValue: true,
        peakAmplitude: true,
        dominantFreqHz: true,
        highLowEnergyRatio: true,
        baselineDeviationScore: true,
        artifactRatioPct: true,
        spectrogramJson: true,
      },
    });

    return {
      idPseudo: patient.idPseudo,
      fistulaType: patient.fistulaType,
      armSide: patient.armSide,
      baselineLocked: patient.baselineLocked,
      measurements: serializeHistory(
        measurements.filter(
          (measurement): measurement is (typeof measurements)[number] & {
            status: NonNullable<(typeof measurements)[number]['status']>;
          } => measurement.status !== null,
        ),
      ),
      disclaimer: CLINICAL_DISCLAIMER,
    };
  }

  async rebaseline(idPseudo: string, dto: RebaselineDto, userId: string) {
    const patient = await this.findByIdPseudo(idPseudo);
    await this.prisma.$transaction(async (tx) => {
      await tx.baselineVersion.updateMany({
        where: { patientId: patient.id, active: true },
        data: { active: false, archivedAt: new Date(), reason: dto.reason },
      });

      await tx.patientPseudo.update({
        where: { id: patient.id },
        data: { baselineLocked: false, baselineVector: Prisma.DbNull },
      });

      await tx.auditEvent.create({
        data: {
          actorId: userId,
          action: 'REBASELINE',
          entity: 'PatientPseudo',
          entityId: patient.id,
          before: { baselineLocked: patient.baselineLocked },
          after: { baselineLocked: false, reason: dto.reason },
        },
      });
    });

    return {
      idPseudo: patient.idPseudo,
      status: 'BASELINE_BUILDING',
      reason: dto.reason,
      rebaselinedAt: new Date().toISOString(),
    };
  }

  async addNote(idPseudo: string, dto: CreateNoteDto, userId: string) {
    const patient = await this.findByIdPseudo(idPseudo);

    const note = await this.prisma.$transaction(async (tx) => {
      const created = await tx.clinicalNote.create({
        data: {
          patientId: patient.id,
          authorId: userId,
          text: dto.text,
          measurementId: dto.measurementId,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: userId,
          action: 'CLINICAL_NOTE_CREATED',
          entity: 'ClinicalNote',
          entityId: created.id,
          after: { patientId: patient.id, measurementId: dto.measurementId ?? null },
        },
      });
      return created;
    });

    return note;
  }

  async getNotes(idPseudo: string) {
    const patient = await this.findByIdPseudo(idPseudo);
    return this.prisma.clinicalNote.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFollowUps(idPseudo: string) {
    const patient = await this.findByIdPseudo(idPseudo);
    const rows = await this.prisma.followUpIntent.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
      select: { measurementId: true, reason: true, createdAt: true },
    });
    return rows.map((row) => ({ idPseudo: patient.idPseudo, ...row }));
  }

  async getBaselineVersions(idPseudo: string) {
    const patient = await this.findByIdPseudo(idPseudo);
    const rows = await this.prisma.baselineVersion.findMany({
      where: { patientId: patient.id },
      orderBy: { lockedAt: 'desc' },
      select: { lockedAt: true, archivedAt: true, reason: true, active: true },
    });
    return rows.map((row) => ({ idPseudo: patient.idPseudo, ...row }));
  }

  async recordFollowUpIntent(idPseudo: string, dto: CreateFollowUpIntentDto, userId: string) {
    const patient = await this.findByIdPseudo(idPseudo);

    const intent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.followUpIntent.create({
        data: {
          patientId: patient.id,
          authorId: userId,
          measurementId: dto.measurementId,
          reason: dto.reason,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: userId,
          action: 'FOLLOW_UP_INTENT_CREATED',
          entity: 'FollowUpIntent',
          entityId: created.id,
          after: { patientId: patient.id, measurementId: dto.measurementId },
        },
      });
      return created;
    });

    return intent;
  }
}
