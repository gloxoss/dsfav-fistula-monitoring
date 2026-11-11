import { ConfigService } from './config.service.js';
import { jest } from '@jest/globals';

describe('clinical threshold proposals', () => {
  const active = { id: 'active-1', version: 1, values: { thresholds: { deviationScore: 3.4 } } };
  const draft = {
    id: 'proposal-1',
    version: 2,
    status: 'DRAFT',
    values: { thresholds: { deviationScore: 3.8 } },
    authorId: 'nephro-author',
    reason: 'Banc synthétique, confiance modérée',
  };

  it('does not change active config or write an audit event when proposing', async () => {
    const configVersion = {
      findFirst: jest.fn(async () => active),
      aggregate: jest.fn(async () => ({ _max: { version: 1 } })),
      create: jest.fn(async () => draft),
    };
    const prisma = {
      configVersion,
    } as never;
    const audit = { write: jest.fn() };
    const service = new ConfigService(prisma, audit as never);

    await service.proposeThreshold({ threshold: 3.8, confidenceNote: 'confiance modérée' }, { sub: 'nephro-author' });

    expect(configVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT', authorId: 'nephro-author' }) }),
    );
    expect(audit.write).not.toHaveBeenCalled();
  });

  it('[AUTHZ-MATRIX] applies a proposal only through nephrologist approval and records an audit event', async () => {
    const tx = { configVersion: { updateMany: jest.fn(async () => ({})), update: jest.fn(async () => ({ ...draft, status: 'ACTIVE' })) } };
    const prisma = {
      configVersion: {
        findUnique: jest.fn(async () => draft),
        findFirst: jest.fn(async () => active),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const audit = { write: jest.fn(async () => ({})) };
    const service = new ConfigService(prisma as never, audit as never);

    const result = await service.approveThresholdProposal('proposal-1', { sub: 'nephro-reviewer', role: 'NEPHROLOGIST' });

    expect(result.status).toBe('ACTIVE');
    expect(tx.configVersion.updateMany).toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'nephro-reviewer', action: 'THRESHOLD_PROPOSAL_APPROVED' }),
      tx,
    );
  });
});
