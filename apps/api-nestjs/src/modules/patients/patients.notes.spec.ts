import 'reflect-metadata';
import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../../common/roles.guard.js';
import { ROLES_KEY } from '../../common/roles.decorator.js';
import { PatientsController } from './patients.controller.js';
import { PatientsService } from './patients.service.js';

describe('patient notes', () => {
  it('[UC8] returns notes newest first for a patient', async () => {
    const notes = [
      { id: 'new', text: 'recent', createdAt: new Date('2026-11-02T00:00:00Z') },
      { id: 'old', text: 'earlier', createdAt: new Date('2026-11-01T00:00:00Z') },
    ];
    const prisma = {
      patientPseudo: { findUnique: jest.fn(async () => ({ id: 'patient-id', idPseudo: 'PT-1' })) },
      clinicalNote: { findMany: jest.fn(async () => notes) },
    };
    const service = new PatientsService(prisma as never);

    await expect(service.getNotes('PT-1')).resolves.toEqual(notes);
    expect(prisma.clinicalNote.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { patientId: 'patient-id' },
      orderBy: { createdAt: 'desc' },
    }));
  });

  it('[UC8] GET /patients/{idPseudo}/notes rejects an intern with 403', () => {
    const handler = Object.getOwnPropertyDescriptor(PatientsController.prototype, 'getNotes')!.value as (...args: never[]) => unknown;
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => handler,
      getClass: () => PatientsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.INTERN } }) }),
    } as unknown as ExecutionContext;

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.NEPHROLOGIST]);
    expect(guard.canActivate.bind(guard, context)).toThrow(ForbiddenException);
  });
});
