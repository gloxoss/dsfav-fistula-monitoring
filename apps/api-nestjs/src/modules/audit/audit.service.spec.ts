import { describe, expect, it, jest } from '@jest/globals';
import { AuditService } from './audit.service.js';
import { PrismaService } from '../../common/prisma.service.js';

describe('AuditService', () => {
  it('[AUTHZ-MATRIX] filters audit rows by action, entity, and date', async () => {
    const row = {
      id: 'audit-1',
      action: 'DEVICE_CALIBRATED',
      entity: 'Device',
      entityId: 'device-1',
      at: new Date('2026-11-08T00:00:00.000Z'),
      after: { calibrationGain: 1.02, reason: 'Contrôle au banc' },
      actor: { role: 'ADMIN' },
    };
    const findMany = jest.fn((..._args: any[]) => Promise.resolve([row]));
    const prisma = { auditEvent: { findMany } } as unknown as PrismaService;
    const service = new AuditService(prisma);
    const from = new Date('2026-11-01T00:00:00.000Z');
    const to = new Date('2026-11-08T00:00:00.000Z');

    const result = await service.list({ action: 'DEVICE_CALIBRATED', entity: 'Device', entityId: 'device-1', from, to });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        action: 'DEVICE_CALIBRATED',
        entity: 'Device',
        entityId: 'device-1',
        at: { gte: from, lte: to },
      },
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
      take: 51,
    });
    expect(result).toEqual({
      items: [{
        id: 'audit-1',
        action: 'DEVICE_CALIBRATED',
        entity: 'Device',
        entityId: 'device-1',
        actorRole: 'ADMIN',
        at: row.at,
        after: { calibrationGain: 1.02, reason: 'Contrôle au banc' },
      }],
      nextCursor: null,
    });
  });

  it('[UC13] limit and cursor give disjoint pages, newest first', async () => {
    const row1 = {
      id: 'audit-1',
      action: 'DEVICE_CALIBRATED',
      entity: 'Device',
      entityId: 'device-1',
      at: new Date('2026-11-08T12:00:00.000Z'),
      after: { calibrationGain: 1.01, reason: 'R1' },
      actor: { role: 'ADMIN' },
    };
    const row2 = {
      id: 'audit-2',
      action: 'DEVICE_CALIBRATED',
      entity: 'Device',
      entityId: 'device-1',
      at: new Date('2026-11-08T11:00:00.000Z'),
      after: { calibrationGain: 1.02, reason: 'R2' },
      actor: { role: 'ADMIN' },
    };
    const row3 = {
      id: 'audit-3',
      action: 'DEVICE_CALIBRATED',
      entity: 'Device',
      entityId: 'device-1',
      at: new Date('2026-11-08T10:00:00.000Z'),
      after: { calibrationGain: 1.03, reason: 'R3' },
      actor: { role: 'ADMIN' },
    };

    const findMany = jest.fn((args: any) => {
      // Simulate database ordering newest first and cursor filtering
      const all = [row1, row2, row3];
      let filtered = all;
      if (args.where?.OR) {
        // cursor condition: at < cursor.at OR (at == cursor.at AND id < cursor.id)
        filtered = [row3];
      }
      return Promise.resolve(filtered.slice(0, args.take));
    });
    const findUnique = jest.fn((args: any) => {
      if (args.where?.id === 'audit-2') {
        return Promise.resolve({ id: 'audit-2', at: row2.at });
      }
      return Promise.resolve(null);
    });

    const prisma = { auditEvent: { findMany, findUnique } } as unknown as PrismaService;
    const service = new AuditService(prisma);

    // Page 1: limit 2
    const page1 = await service.list({ limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.items.map((i) => i.id)).toEqual(['audit-1', 'audit-2']);
    expect(page1.nextCursor).toBe('audit-2');

    // Page 2: with cursor from page 1
    const page2 = await service.list({ limit: 2, cursor: page1.nextCursor! });
    expect(page2.items).toHaveLength(1);
    expect(page2.items.map((i) => i.id)).toEqual(['audit-3']);
    expect(page2.nextCursor).toBeNull();

    // Disjoint verification
    const ids1 = new Set(page1.items.map((i) => i.id));
    const disjoint = page2.items.every((i) => !ids1.has(i.id));
    expect(disjoint).toBe(true);
  });
});
