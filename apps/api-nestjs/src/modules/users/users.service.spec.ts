import { describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from '../../common/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  it('[PSEUDO-SCAN] returns role and status only', async () => {
    const findMany = jest.fn((..._args: any[]) =>
      Promise.resolve([
        { role: 'ADMIN', isActive: true },
        { role: 'NURSE', isActive: false },
      ]),
    );
    const prisma = { user: { findMany } } as unknown as PrismaService;
    const service = new UsersService(prisma);

    await expect(service.list()).resolves.toEqual([
      { role: 'ADMIN', status: 'ACTIVE' },
      { role: 'NURSE', status: 'DISABLED' },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      select: { role: true, isActive: true },
      orderBy: { role: 'asc' },
    });
  });
});
