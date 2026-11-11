import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../../common/prisma.service.js';

interface ConfigUser { sub: string; role?: string }
interface ThresholdProposal { threshold: number; confidenceNote: string }

@Injectable()
export class ConfigService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async getActive() {
    const active = await this.prisma.configVersion.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, values: true, publishedAt: true },
    });
    if (!active) {
      throw new ServiceUnavailableException({
        code: 'CONFIG_UNAVAILABLE',
        message_fr: 'Aucune configuration clinique active',
        retryable: true,
      });
    }
    return active;
  }

  async proposeThreshold(input: ThresholdProposal, user: ConfigUser) {
    if (!Number.isFinite(input.threshold) || input.threshold <= 0 || !input.confidenceNote?.trim()) {
      throw new BadRequestException({ code: 'INVALID_THRESHOLD_PROPOSAL', message_fr: 'Seuil et note de confiance obligatoires', retryable: false });
    }
    const active = await this.prisma.configVersion.findFirst({ where: { status: 'ACTIVE' }, orderBy: { version: 'desc' } });
    if (!active) throw new ServiceUnavailableException({ code: 'CONFIG_UNAVAILABLE', message_fr: 'Aucune configuration clinique active', retryable: true });
    const latest = await this.prisma.configVersion.aggregate({ _max: { version: true } });
    const currentValues = active.values as Record<string, unknown>;
    const currentThresholds = (currentValues.thresholds ?? {}) as Record<string, unknown>;
    const values = { ...currentValues, thresholds: { ...currentThresholds, deviationScore: input.threshold } };
    return this.prisma.configVersion.create({
      data: {
        version: (latest._max.version ?? active.version) + 1,
        status: 'DRAFT',
        values,
        authorId: user.sub,
        reason: `Proposition issue du banc. Confiance : ${input.confidenceNote.trim()}`,
      },
      select: { id: true, version: true, status: true, values: true, reason: true, authorId: true },
    });
  }

  async approveThresholdProposal(id: string, user: ConfigUser) {
    if (user.role !== 'NEPHROLOGIST') throw new ForbiddenException({ code: 'ROLE_FORBIDDEN', message_fr: 'Validation réservée au néphrologue', retryable: false });
    const proposal = await this.prisma.configVersion.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException({ code: 'PROPOSAL_UNKNOWN', message_fr: 'Proposition inconnue', retryable: false });
    if (proposal.status !== 'DRAFT') throw new ConflictException({ code: 'PROPOSAL_NOT_DRAFT', message_fr: 'Cette proposition n’est plus en attente', retryable: false });
    if (proposal.authorId === user.sub) throw new ForbiddenException({ code: 'REVIEWER_MUST_DIFFER', message_fr: 'Un autre néphrologue doit valider la proposition', retryable: false });
    const active = await this.prisma.configVersion.findFirst({ where: { status: 'ACTIVE' }, orderBy: { version: 'desc' } });
    if (!active) throw new ServiceUnavailableException({ code: 'CONFIG_UNAVAILABLE', message_fr: 'Aucune configuration clinique active', retryable: true });
    return this.prisma.$transaction(async (tx) => {
      await tx.configVersion.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'ARCHIVED' } });
      const approved = await tx.configVersion.update({
        where: { id: proposal.id },
        data: { status: 'ACTIVE', reviewerId: user.sub, publishedAt: new Date() },
        select: { id: true, version: true, status: true, values: true, publishedAt: true },
      });
      await this.audit.write({
        actorId: user.sub,
        action: 'THRESHOLD_PROPOSAL_APPROVED',
        entity: 'ConfigVersion',
        entityId: proposal.id,
        before: active.values as never,
        after: approved.values as never,
      }, tx);
      return approved;
    });
  }
}
