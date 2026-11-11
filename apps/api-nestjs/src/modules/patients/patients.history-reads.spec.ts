import { describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from '../../common/prisma.service.js';
import { PatientsService } from './patients.service.js';

describe('PatientsService history reads', () => {
  it('[AUTHZ-MATRIX] [UC8] lists follow-up intents with only the patient pseudonym', async () => {
    const patientFindUnique = jest.fn((..._args: any[]) => Promise.resolve({ id: 'patient-db-id', idPseudo: 'PT-CAS-8841' }));
    const findMany = jest.fn((..._args: any[]) =>
      Promise.resolve([
        { measurementId: 'measurement-1', reason: 'Revoir avec le néphrologue', createdAt: new Date('2026-11-08T10:00:00.000Z') },
      ]),
    );
    const prisma = {
      patientPseudo: { findUnique: patientFindUnique },
      followUpIntent: { findMany },
    } as unknown as PrismaService;
    const service = new PatientsService(prisma);

    await expect(service.getFollowUps('PT-CAS-8841')).resolves.toEqual([
      { idPseudo: 'PT-CAS-8841', measurementId: 'measurement-1', reason: 'Revoir avec le néphrologue', createdAt: new Date('2026-11-08T10:00:00.000Z') },
    ]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { patientId: 'patient-db-id' } }));
  });

  it('[AUTHZ-MATRIX] returns baseline versions with lock dates, reasons, status, and idPseudo only', async () => {
    const patientFindUnique = jest.fn((..._args: any[]) => Promise.resolve({ id: 'patient-db-id', idPseudo: 'PT-CAS-8841' }));
    const findMany = jest.fn((..._args: any[]) =>
      Promise.resolve([
        { lockedAt: new Date('2026-11-01T10:00:00.000Z'), archivedAt: new Date('2026-11-07T10:00:00.000Z'), reason: 'Après intervention', active: false },
      ]),
    );
    const prisma = {
      patientPseudo: { findUnique: patientFindUnique },
      baselineVersion: { findMany },
    } as unknown as PrismaService;
    const service = new PatientsService(prisma);

    await expect(service.getBaselineVersions('PT-CAS-8841')).resolves.toEqual([
      { idPseudo: 'PT-CAS-8841', lockedAt: new Date('2026-11-01T10:00:00.000Z'), archivedAt: new Date('2026-11-07T10:00:00.000Z'), reason: 'Après intervention', active: false },
    ]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { patientId: 'patient-db-id' } }));
  });
});
