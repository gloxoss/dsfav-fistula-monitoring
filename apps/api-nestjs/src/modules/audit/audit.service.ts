import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service.js';

export interface AuditListFilters {
  action?: string;
  entity?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
}

export interface AuditEventItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorRole: string;
  at: Date;
  after: Record<string, unknown> | null;
}

export interface AuditListPage {
  items: AuditEventItem[];
  nextCursor: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: AuditListFilters = {}): Promise<AuditListPage> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const where: Prisma.AuditEventWhereInput = {};
    if (filters.action) where.action = filters.action;
    if (filters.entity) where.entity = filters.entity;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.from || filters.to) {
      where.at = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    if (filters.cursor) {
      const cursorEvent = await this.prisma.auditEvent.findUnique({
        where: { id: filters.cursor },
        select: { id: true, at: true },
      });
      if (cursorEvent) {
        where.OR = [
          { at: { lt: cursorEvent.at } },
          { at: cursorEvent.at, id: { lt: cursorEvent.id } },
        ];
      } else {
        const cursorDate = new Date(filters.cursor);
        if (!isNaN(cursorDate.getTime())) {
          where.at = {
            ...(where.at as Prisma.DateTimeFilter),
            lt: cursorDate,
          };
        }
      }
    }

    const events = await this.prisma.auditEvent.findMany({
      where,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        at: true,
        after: true,
        actor: { select: { role: true } },
      },
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = events.length > limit;
    const pagedEvents = hasMore ? events.slice(0, limit) : events;
    const items: AuditEventItem[] = pagedEvents.map(({ actor, after, ...event }) => ({
      ...event,
      actorRole: actor.role,
      after: sanitizeAfter(event.action, after),
    }));

    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
    };
  }

  write(input: {
    actorId: string;
    action: string;
    entity: string;
    entityId?: string | null;
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
  }, tx: Prisma.TransactionClient = this.prisma) {
    return tx.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        before: input.before ?? Prisma.DbNull,
        after: input.after ?? Prisma.DbNull,
      },
    });
  }
}

const SAFE_AFTER_KEYS: Readonly<Record<string, readonly string[]>> = {
  DEVICE_CALIBRATED: ['calibrationGain', 'reason'],
  BASELINE_LOCKED: ['rmsMean', 'ratioMean', 'fpeakMean'],
  REBASELINE: ['baselineLocked', 'reason'],
  MEASUREMENT_ABANDONED: ['reason'],
};

function sanitizeAfter(action: string, value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const allowed = SAFE_AFTER_KEYS[action];
  if (!allowed) return null;
  return Object.fromEntries(allowed.flatMap((key) => {
    const field = value[key];
    return field === null || typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean'
      ? [[key, field]]
      : [];
  }));
}
