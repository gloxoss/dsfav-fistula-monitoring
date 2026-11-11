import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BenchSession, MeasurementSource, PerceivedThrill, UserRole } from '@prisma/client';
import { CLINICAL_DISCLAIMER } from '../../common/constants.js';
import { PrismaService } from '../../common/prisma.service.js';
import { BENCH_NOTICE, EXPECTED_PROFILE_LABEL } from './bench.constants.js';
import { computeConcordance, expectedProfileFor, placeholderIntensityLevel } from './bench.concordance.js';
import { CompleteBenchCaptureDto, CreateBenchSessionDto, SubmitBenchPalpationDto } from './bench.dto.js';

interface UserContext {
  sub: string;
  role: string;
}

const PALPATION_REQUIRED_MESSAGE = 'Décrivez d’abord votre palpation';

@Injectable()
export class BenchService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: UserContext) {
    const rows = await this.prisma.benchSession.findMany({
      where: user.role === UserRole.INTERN ? { internId: user.sub } : {},
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toSummary(row));
  }

  async create(dto: CreateBenchSessionDto, user: UserContext) {
    const row = await this.prisma.benchSession.create({
      data: {
        internId: user.sub,
        pumpFlowMlMin: dto.pumpFlowMlMin,
        clampStenosisPct: dto.clampStenosisPct,
        expectedProfile: expectedProfileFor(dto.clampStenosisPct),
      },
    });
    return this.toSummary(row);
  }

  async submitPalpation(sessionId: string, dto: SubmitBenchPalpationDto, user: UserContext) {
    const session = await this.findOwnedSession(sessionId, user);
    if (session.palpationLockedAt) {
      throw new BadRequestException({
        code: 'PALPATION_LOCKED',
        message_fr: 'La palpation est déjà verrouillée pour cette séance',
        retryable: false,
      });
    }
    const claimed = await this.prisma.benchSession.updateMany({
      where: { id: session.id, palpationLockedAt: null },
      data: {
        perceivedThrill: dto.perceivedThrill,
        perceivedIntensity: dto.perceivedIntensity,
        internNotes: dto.internNotes ?? null,
        palpationLockedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      const current = await this.findOwnedSession(sessionId, user);
      if (current.palpationLockedAt) {
        throw new BadRequestException({
          code: 'PALPATION_LOCKED',
          message_fr: 'La palpation est déjà verrouillée pour cette séance',
          retryable: false,
        });
      }
      throw new ConflictException({
        code: 'PALPATION_LOCKED',
        message_fr: 'La palpation ne peut pas être verrouillée pour cette séance',
        retryable: false,
      });
    }
    const updated = await this.prisma.benchSession.findUniqueOrThrow({ where: { id: session.id } });
    return this.toSummary(updated);
  }

  async capture(sessionId: string, dto: CompleteBenchCaptureDto, user: UserContext) {
    const session = await this.findOwnedSession(sessionId, user);
    if (!session.palpationLockedAt || !session.perceivedThrill || session.perceivedIntensity === null) {
      throw new ConflictException({
        code: 'PALPATION_REQUIRED',
        message_fr: PALPATION_REQUIRED_MESSAGE,
        retryable: false,
      });
    }
    if (session.measurementId) {
      throw new ConflictException({
        code: 'BENCH_ALREADY_CAPTURED',
        message_fr: 'Cette séance a déjà une mesure associée.',
        retryable: false,
      });
    }

    const measurement = await this.prisma.measurement.findUnique({ where: { id: dto.measurementId } });
    if (!measurement) {
      throw new NotFoundException({
        code: 'MEASUREMENT_UNKNOWN',
        message_fr: 'Séance inconnue',
        retryable: false,
      });
    }
    if (measurement.source !== MeasurementSource.BENCH) {
      throw new BadRequestException({
        code: 'MEASUREMENT_NOT_BENCH',
        message_fr: 'Cette mesure ne provient pas du banc de formation',
        retryable: false,
      });
    }
    if (measurement.operatorId !== user.sub) {
      throw new ForbiddenException({
        code: 'MEASUREMENT_OWNER',
        message_fr: 'Cette mesure appartient à un autre opérateur',
        retryable: false,
      });
    }
    if (measurement.rmsValue === null) {
      throw new ConflictException({
        code: 'MEASUREMENT_NOT_ANALYSED',
        message_fr: 'La mesure n’est pas encore analysée',
        retryable: true,
      });
    }

    const expectedProfile =
      (session.expectedProfile as PerceivedThrill | null) ?? expectedProfileFor(session.clampStenosisPct);
    const measuredIntensityLevel = placeholderIntensityLevel(measurement.rmsValue, session.pumpFlowMlMin);
    const concordance = computeConcordance({
      perceivedThrill: session.perceivedThrill,
      perceivedIntensity: session.perceivedIntensity,
      internNotes: session.internNotes,
      expectedProfile,
      measuredIntensityLevel,
    });

    const claimed = await this.prisma.benchSession.updateMany({
      where: { id: session.id, measurementId: null, palpationLockedAt: { not: null } },
      data: {
        measurementId: measurement.id,
        expectedProfile,
        concordanceScore: concordance.total,
        concordanceBreakdown: {
          ...concordance.breakdown,
          measuredIntensityLevel,
          expectedProfileLabel: EXPECTED_PROFILE_LABEL,
        },
      },
    });
    if (claimed.count === 0) {
      const current = await this.findOwnedSession(sessionId, user);
      if (!current.palpationLockedAt || !current.perceivedThrill || current.perceivedIntensity === null) {
        throw new ConflictException({
          code: 'PALPATION_REQUIRED',
          message_fr: PALPATION_REQUIRED_MESSAGE,
          retryable: false,
        });
      }
      throw new ConflictException({
        code: 'BENCH_ALREADY_CAPTURED',
        message_fr: 'Cette séance a déjà une mesure associée.',
        retryable: false,
      });
    }
    const updated = await this.prisma.benchSession.findUniqueOrThrow({ where: { id: session.id } });
    return this.toResult(updated);
  }

  private async findOwnedSession(sessionId: string, user: UserContext) {
    const session = await this.prisma.benchSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException({
        code: 'BENCH_SESSION_UNKNOWN',
        message_fr: 'Séance de banc inconnue',
        retryable: false,
      });
    }
    if (session.internId !== user.sub) {
      throw new ForbiddenException({
        code: 'BENCH_OWNER',
        message_fr: 'Cette séance de banc appartient à un autre interne',
        retryable: false,
      });
    }
    return session;
  }

  private toSummary(row: BenchSession) {
    return {
      id: row.id,
      internId: row.internId,
      measurementId: row.measurementId,
      pumpFlowMlMin: row.pumpFlowMlMin,
      clampStenosisPct: row.clampStenosisPct,
      perceivedThrill: row.perceivedThrill,
      perceivedIntensity: row.perceivedIntensity,
      concordanceScore: row.concordanceScore,
      createdAt: row.createdAt,
      benchNotice: BENCH_NOTICE,
    };
  }

  private toResult(row: BenchSession) {
    return {
      sessionId: row.id,
      internId: row.internId,
      measurementId: row.measurementId,
      pumpFlowMlMin: row.pumpFlowMlMin,
      clampStenosisPct: row.clampStenosisPct,
      perceivedThrill: row.perceivedThrill,
      perceivedIntensity: row.perceivedIntensity,
      internNotes: row.internNotes,
      expectedProfile: row.expectedProfile,
      expectedProfileLabel: EXPECTED_PROFILE_LABEL,
      concordanceScore: row.concordanceScore,
      concordanceBreakdown: row.concordanceBreakdown,
      disclaimer: CLINICAL_DISCLAIMER,
      benchNotice: BENCH_NOTICE,
    };
  }
}
