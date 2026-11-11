// T-s11 [UC12] [NO-LOSS] — devices sync, calibration, offline no-loss property.
// Runs the real DevicesModule against the seeded Postgres and the real DSP service
// (pnpm --filter @dsfav/api test).
import { DsfavWsAdapter } from '../src/realtime/dsfav-ws.adapter.js';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import fc from 'fast-check';
import { DevicesModule } from '../src/modules/devices/devices.module.js';
import { HttpExceptionFilter } from '../src/common/http-exception.filter.js';
import { CLINICAL_DISCLAIMER } from '../src/common/constants.js';
import { PrismaService } from '../src/common/prisma.service.js';

const TEST_PATIENT_PSEUDO = 'PT-CAS-1111';
const KEY_PREFIX = 'T-s11-';
let keyCounter = 0;

type AppWithBodyParser = INestApplication & {
  useBodyParser(type: 'json', options: { limit: string }): void;
};

function nextKey(): string {
  keyCounter += 1;
  return `${KEY_PREFIX}key-${keyCounter}`;
}

interface SyncItemPayload {
  idempotencyKey: string;
  patient: string;
  capturedAt: string;
  raw_b64: string;
  header?: Record<string, number>;
}

function buildCaptureRaw(durationSec: number, pressureKpa: number): Buffer {
  const sampleRateAdxl = 1000;
  const sampleRateLis = 200;
  const adxlSamples = Math.round(sampleRateAdxl * durationSec);
  const lisSamples = Math.round(sampleRateLis * durationSec);
  const pressureSamples = Math.floor((adxlSamples * 10) / sampleRateAdxl);
  const header = Buffer.alloc(18);
  header.write('DSFV', 0, 'ascii');
  header.writeUInt16LE(1, 4);
  header.writeUInt16LE(sampleRateAdxl, 6);
  header.writeUInt16LE(sampleRateLis, 8);
  header.writeUInt32LE(adxlSamples, 10);
  header.writeUInt32LE(lisSamples, 14);
  const buffer = Buffer.alloc(18 + adxlSamples * 6 + lisSamples * 6 + pressureSamples * 2);
  header.copy(buffer, 0);
  let offset = 18;
  for (let i = 0; i < adxlSamples * 3; i += 3) {
    const row = Math.floor(i / 3);
    const t = row / sampleRateAdxl;
    const thrill = 0.35 * Math.sin(2 * Math.PI * 50 * t) + 0.25 * Math.sin(2 * Math.PI * 220 * t);
    buffer.writeInt16LE(Math.round(thrill * 16384), offset);
    buffer.writeInt16LE(0, offset + 2);
    buffer.writeInt16LE(0, offset + 4);
    offset += 6;
  }
  for (let i = 0; i < lisSamples * 3; i += 3) {
    const row = Math.floor(i / 3);
    const t = row / sampleRateLis;
    buffer.writeInt16LE(Math.round(0.007 * Math.sin(2 * Math.PI * 0.9 * t) * 1024), offset);
    buffer.writeInt16LE(0, offset + 2);
    buffer.writeInt16LE(0, offset + 4);
    offset += 6;
  }
  for (let i = 0; i < pressureSamples; i += 1) {
    buffer.writeInt16LE(Math.round(pressureKpa * 100), offset);
    offset += 2;
  }
  return buffer;
}

function capturePayload(durationSec = 25, pressureKpa = 5): SyncItemPayload {
  return {
    idempotencyKey: nextKey(),
    patient: TEST_PATIENT_PSEUDO,
    capturedAt: new Date().toISOString(),
    raw_b64: buildCaptureRaw(durationSec, pressureKpa).toString('base64'),
  };
}

function syncBody(items: SyncItemPayload[], batteryPct?: number) {
  return {
    deviceSerial: 'DSFAV-UNIT-01',
    ...(batteryPct === undefined ? {} : { batteryPct }),
    items,
  };
}

describe('Devices fleet, calibration and idempotent sync (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let nurseToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DevicesModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new DsfavWsAdapter(app));
    (app as AppWithBodyParser).useBodyParser('json', { limit: '16mb' });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.measurement.deleteMany({
      where: { idempotencyKey: { startsWith: KEY_PREFIX } },
    });
    await prisma.patientPseudo.deleteMany({ where: { idPseudo: TEST_PATIENT_PSEUDO } });
    const patient = await prisma.patientPseudo.create({
      data: { idPseudo: TEST_PATIENT_PSEUDO, fistulaType: 'RADIO_CEPHALIC', armSide: 'LEFT', baselineLocked: true },
    });
    await prisma.baselineVersion.create({
      data: {
        patientId: patient.id,
        rmsMean: 0.145,
        rmsStd: 0.012,
        ratioMean: 0.32,
        ratioStd: 0.025,
        fpeakMean: 68.0,
        fpeakStd: 4.5,
      },
    });

    const nurseRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nurse@dsfav.local', password: 'demo1234' });
    nurseToken = nurseRes.body.token;

    const adminRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@dsfav.local', password: 'demo1234' });
    adminToken = adminRes.body.token;
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      await prisma.measurement.deleteMany({
        where: { idempotencyKey: { startsWith: KEY_PREFIX } },
      });
      await prisma.baselineVersion.deleteMany({
        where: { patient: { idPseudo: TEST_PATIENT_PSEUDO } },
      });
      await prisma.patientPseudo.deleteMany({ where: { idPseudo: TEST_PATIENT_PSEUDO } });
    }
    await app.close();
  }, 30000);

  describe('Device registry', () => {
    it('GET /devices lists the fleet with calibration data [AUTHZ-MATRIX]', async () => {
      const res = await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const unit04 = res.body.find((d: { serialNumber: string }) => d.serialNumber === 'DSFAV-UNIT-04');
      expect(unit04).toMatchObject({
        serialNumber: 'DSFAV-UNIT-04',
        calibrationGain: 1.039,
        lastBatteryPct: 12,
      });
      expect(unit04.id).toBeDefined();
      expect(unit04.macAddress).toBeDefined();
      expect(unit04.lastSeenAt).toBeDefined();
    });

    it('GET /devices/:id returns one device', async () => {
      const list = await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const unit01 = list.body.find((d: { serialNumber: string }) => d.serialNumber === 'DSFAV-UNIT-01');

      const res = await request(app.getHttpServer())
        .get(`/devices/${unit01.id}`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(200);
      expect(res.body).toMatchObject({ id: unit01.id, serialNumber: 'DSFAV-UNIT-01' });
    });

    it('GET /devices/:id on unknown id -> 404 DEVICE_UNKNOWN', async () => {
      const res = await request(app.getHttpServer())
        .get('/devices/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(404);
      expect(res.body).toMatchObject({ code: 'DEVICE_UNKNOWN', message_fr: expect.any(String), retryable: false });
    });
  });

  describe('Calibration [AUTHZ-MATRIX]', () => {
    it('[AUTHZ-MATRIX] nurse cannot calibrate -> 403 and no AuditEvent', async () => {
      const before = await prisma.auditEvent.count({ where: { action: 'DEVICE_CALIBRATED' } });
      const list = await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const unit01 = list.body.find((d: { serialNumber: string }) => d.serialNumber === 'DSFAV-UNIT-01');

      await request(app.getHttpServer())
        .post(`/devices/${unit01.id}/calibration`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ calibrationGain: 1.01, reason: 'Tentative infirmier' })
        .expect(403);

      expect(await prisma.auditEvent.count({ where: { action: 'DEVICE_CALIBRATED' } })).toBe(before);
    });

    it('[AUTHZ-MATRIX] intern cannot calibrate -> 403', async () => {
      const list = await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const unit01 = list.body.find((d: { serialNumber: string }) => d.serialNumber === 'DSFAV-UNIT-01');

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'intern@dsfav.local', password: 'demo1234' });
      await request(app.getHttpServer())
        .post(`/devices/${unit01.id}/calibration`)
        .set('Authorization', `Bearer ${login.body.token}`)
        .send({ calibrationGain: 1.01, reason: 'Interne' })
        .expect(403);
    });

    it('admin calibrates UNIT-01 within tolerance -> 200, gain updated, AuditEvent written', async () => {
      const list = await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const unit01 = list.body.find((d: { serialNumber: string }) => d.serialNumber === 'DSFAV-UNIT-01');

      const auditWhere = { action: 'DEVICE_CALIBRATED', entity: 'Device', entityId: unit01.id };
      const auditBefore = await prisma.auditEvent.count({ where: auditWhere });
      const res = await request(app.getHttpServer())
        .post(`/devices/${unit01.id}/calibration`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ calibrationGain: 1.002, reason: 'Étalonnage annuel banc 400 mL/min' })
        .expect(200);

      expect(res.body).toMatchObject({ id: unit01.id, calibrationGain: 1.002 });
      expect(await prisma.auditEvent.count({ where: auditWhere })).toBe(auditBefore + 1);

      // Restore the seeded gain for the other suites.
      await request(app.getHttpServer())
        .post(`/devices/${unit01.id}/calibration`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ calibrationGain: 1.0, reason: 'Retour valeur banc USv' })
        .expect(200);
    });

    it('calibration beyond the 3 % tolerance -> 400 and no write', async () => {
      const list = await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const unit01 = list.body.find((d: { serialNumber: string }) => d.serialNumber === 'DSFAV-UNIT-01');

      const gainBefore = unit01.calibrationGain;
      const res = await request(app.getHttpServer())
        .post(`/devices/${unit01.id}/calibration`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ calibrationGain: gainBefore * 1.1, reason: 'Saut suspect' })
        .expect(400);

      expect(res.body).toMatchObject({ code: 'CALIBRATION_OUT_OF_TOLERANCE', retryable: false });
      const after = await prisma.device.findUniqueOrThrow({ where: { id: unit01.id } });
      expect(after.calibrationGain).toBe(gainBefore);
    });
  });

  describe('Idempotent sync [UC12]', () => {
    it('[UC12] POST /devices/sync with the same idempotencyKey twice -> one row, second call returns the existing result', async () => {
      const itemPayload = capturePayload();
      const body = syncBody([itemPayload]);

      const first = await request(app.getHttpServer())
        .post('/devices/sync')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send(body)
        .expect(200);

      expect(first.body.syncedCount).toBe(1);
      expect(first.body.failedCount).toBe(0);
      expect(first.body.results[0]).toMatchObject({
        idempotencyKey: itemPayload.idempotencyKey,
        state: 'SYNCED',
        error: null,
      });
      expect(first.body.results[0].measurement.baseline_comparison.disclaimer).toBe(CLINICAL_DISCLAIMER);

      const second = await request(app.getHttpServer())
        .post('/devices/sync')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send(body)
        .expect(200);

      expect(second.body.results[0]).toMatchObject({ state: 'SYNCED', error: null });

      const rows = await prisma.measurement.findMany({
        where: { idempotencyKey: itemPayload.idempotencyKey },
      });
      expect(rows).toHaveLength(1);
      expect(second.body.results[0].measurement).toEqual(first.body.results[0].measurement);
    });

    it('[UC12] unknown device serial -> per-item FAILED, nothing stored', async () => {
      const payload = capturePayload();
      const res = await request(app.getHttpServer())
        .post('/devices/sync')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ deviceSerial: 'DSFAV-UNIT-99', items: [payload] })
        .expect(200);

      expect(res.body.failedCount).toBe(1);
      expect(res.body.results[0]).toMatchObject({ state: 'FAILED', error: expect.any(String) });
      expect(await prisma.measurement.count({ where: { idempotencyKey: payload.idempotencyKey } })).toBe(0);
    });

    it('[UC12] malformed raw_b64 -> per-item FAILED, nothing stored', async () => {
      const payload: SyncItemPayload = { ...capturePayload(), raw_b64: Buffer.from('not a capture').toString('base64') };
      const res = await request(app.getHttpServer())
        .post('/devices/sync')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send(syncBody([payload]))
        .expect(200);

      expect(res.body.results[0]).toMatchObject({ state: 'FAILED', error: expect.any(String) });
      expect(await prisma.measurement.count({ where: { idempotencyKey: payload.idempotencyKey } })).toBe(0);
    });

    it('[UC12] sync batch over 50 items -> 400 SYNC_BATCH_TOO_LARGE', async () => {
      const res = await request(app.getHttpServer())
        .post('/devices/sync')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send(syncBody(Array.from({ length: 51 }, () => capturePayload())))
        .expect(400);

      expect(res.body).toEqual({
        code: 'SYNC_BATCH_TOO_LARGE',
        message_fr: 'Trop de sessions dans un envoi (maximum 50).',
        retryable: false,
      });
    }, 30000);

    it('[UC12] patient measured on UNIT-03 then UNIT-04 -> same baseline continues, gain applied per device', async () => {
      const keyA = nextKey();
      const keyB = nextKey();
      const payloads: Array<{ key: string; serial: string; expectedGain: number; durationSec: number; pressureKpa: number }> = [
        { key: keyA, serial: 'DSFAV-UNIT-03', expectedGain: 1.0, durationSec: 25, pressureKpa: 5 },
        { key: keyB, serial: 'DSFAV-UNIT-04', expectedGain: 1.039, durationSec: 25, pressureKpa: 5 },
      ];

      for (const spec of payloads) {
        const item: SyncItemPayload = {
          idempotencyKey: spec.key,
          patient: TEST_PATIENT_PSEUDO,
          capturedAt: new Date().toISOString(),
          raw_b64: buildCaptureRaw(spec.durationSec, spec.pressureKpa).toString('base64'),
        };
        const res = await request(app.getHttpServer())
          .post('/devices/sync')
          .set('Authorization', `Bearer ${nurseToken}`)
          .send({ deviceSerial: spec.serial, items: [item] })
          .expect(200);
        expect(res.body.results[0]).toMatchObject({ state: 'SYNCED', error: null });
      }

      const rows = {
        a: await prisma.measurement.findUniqueOrThrow({ where: { idempotencyKey: keyA } }),
        b: await prisma.measurement.findUniqueOrThrow({ where: { idempotencyKey: keyB } }),
      };
      expect(rows.a.deviceGain).toBeCloseTo(1.0, 6);
      expect(rows.b.deviceGain).toBeCloseTo(1.039, 6);
      expect(rows.a.patientId).toBe(rows.b.patientId);
      expect(rows.a.baselineDeviationScore).not.toBeNull();
      expect(rows.a.baselineDeviationScore).not.toBe(rows.b.baselineDeviationScore);

      const baselineRow = await prisma.baselineVersion.findFirstOrThrow({
        where: { patient: { idPseudo: TEST_PATIENT_PSEUDO } },
      });
      expect(baselineRow.active).toBe(true);
    });
  });

  describe('[NO-LOSS] property', () => {
    it('[NO-LOSS] random captures with random connection drops and duplicate sends -> stored sessions == accepted captures', async () => {
      const runPrefix = `${KEY_PREFIX}prop-`;
      let scenario = 0;

      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({ dropFirst: fc.boolean(), duplicate: fc.boolean() }), {
            minLength: 3,
            maxLength: 5,
          }),
          async (specs) => {
            scenario += 1;
            const keys = specs.map(() => `${runPrefix}${nextKey()}`);
            const expectedAccepted: number[] = [];

            for (let i = 0; i < specs.length; i += 1) {
              const payload = capturePayload();
              const item: SyncItemPayload = { ...payload, idempotencyKey: keys[i] };
              const sent: number[] = [];

              if (!specs[i].dropFirst) {
                const res = await request(app.getHttpServer())
                  .post('/devices/sync')
                  .set('Authorization', `Bearer ${nurseToken}`)
                  .send(syncBody([item]))
                  .expect(200);
                expect(res.body.results[0].state).toBe('SYNCED');
                sent.push(1);
              }
              if (specs[i].duplicate) {
                const res = await request(app.getHttpServer())
                  .post('/devices/sync')
                  .set('Authorization', `Bearer ${nurseToken}`)
                  .send(syncBody([item]))
                  .expect(200);
                expect(res.body.results[0].state).toBe('SYNCED');
                sent.push(1);
              }
              expectedAccepted.push(sent.length > 0 ? 1 : 0);
            }

            const stored = await prisma.measurement.count({
              where: { idempotencyKey: { in: keys, startsWith: runPrefix } },
            });
            const accepted = expectedAccepted.reduce((a, b) => a + b, 0);
            expect(stored).toBe(accepted);
          },
        ),
        { numRuns: 2 },
      );
    }, 30000);
  });
});
