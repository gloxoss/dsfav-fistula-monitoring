import { DsfavWsAdapter } from '../src/realtime/dsfav-ws.adapter.js';
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/http-exception.filter.js';
import { CLINICAL_DISCLAIMER } from '../src/common/constants.js';
import { PrismaService } from '../src/common/prisma.service.js';
import { DspClient, DspResult } from '../src/modules/measurements/dsp.client.js';
import { AlertStatus, MeasurementState, RejectReason } from '@prisma/client';
import { BaselineService } from '../src/modules/baseline/baseline.service.js';

const patientPseudo = 'PT-CAS-8841';
const deviceId = 'dev-01-001';
const ISOLATED_PATIENT_ID = 'p-test-iso-001';
const baselineFixtureKeys = ['test-lifecycle-init-001', 'test-lifecycle-abandoned-001', 'test-lifecycle-analysed-001'];

function simulatorCapture(): Buffer {
  const adxlSamples = 25_000;
  const lisSamples = 5_000;
  const pressureSamples = 250;
  const raw = Buffer.alloc(18 + adxlSamples * 6 + lisSamples * 6 + pressureSamples * 2);
  raw.write('DSFV', 0, 'ascii');
  raw.writeUInt16LE(1, 4);
  raw.writeUInt16LE(1000, 6);
  raw.writeUInt16LE(200, 8);
  raw.writeUInt32LE(adxlSamples, 10);
  raw.writeUInt32LE(lisSamples, 14);
  const pressureOffset = 18 + adxlSamples * 6 + lisSamples * 6;
  for (let index = 0; index < pressureSamples; index += 1) raw.writeInt16LE(540, pressureOffset + index * 2);
  return raw;
}

const fakeResult: DspResult = {
  status: 'NORMAL', reject_reason: null, clean_seconds: 24, artifact_epochs: [],
  rms: 0.145, p2p: 0.41, dominant_hz: 68, ratio: 0.32, deviation: 0,
  top_feature: null, top_change_pct: null, stft: [], explanation: 'Dans la référence personnelle.',
  disclaimer: CLINICAL_DISCLAIMER,
};

describe('Measurements [UC6] [UC3]', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let nurseToken: string;
  let measurementId: string;
  const createdMeasurementIds: string[] = [];
  const fakeDsp = { process: jest.fn<() => Promise<DspResult>>().mockResolvedValue(fakeResult) };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DspClient).useValue(fakeDsp).compile();
    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new DsfavWsAdapter(app));
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.measurement.deleteMany({ where: { idempotencyKey: { in: baselineFixtureKeys } } });
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email: 'nurse@dsfav.local', password: 'demo1234' });
    nurseToken = login.body.token;
  }, 30000);

  afterAll(async () => {
    await prisma.measurement.deleteMany({ where: { id: { in: createdMeasurementIds } } });
    await prisma.measurement.deleteMany({ where: { idempotencyKey: { in: baselineFixtureKeys } } });
    await prisma.measurement.deleteMany({ where: { patientId: ISOLATED_PATIENT_ID } });
    await prisma.baselineVersion.deleteMany({ where: { patientId: ISOLATED_PATIENT_ID } });
    await prisma.patientPseudo.deleteMany({ where: { id: ISOLATED_PATIENT_ID } });
    await app.close();
  }, 30000);

  it('[UC6] create INIT measurement then upload simulator capture through the fake DSP', async () => {
    const created = await request(app.getHttpServer())
      .post('/measurements').set('Authorization', `Bearer ${nurseToken}`)
      .send({ deviceId, idPseudo: patientPseudo }).expect(201);
    measurementId = created.body.measurementId;
    createdMeasurementIds.push(measurementId);
    expect(created.body.state).toBe('INIT');
    expect((await prisma.measurement.findUniqueOrThrow({ where: { id: measurementId } })).status).toBeNull();

    const uploaded = await request(app.getHttpServer())
      .put(`/measurements/${measurementId}/raw`).set('Authorization', `Bearer ${nurseToken}`)
      .set('Content-Type', 'application/octet-stream').send(simulatorCapture()).expect(200);

    expect(fakeDsp.process).toHaveBeenCalledTimes(1);
    expect(uploaded.body.state).toBe('ANALYSED');
    expect(uploaded.body.disclaimer).toBe(fakeResult.disclaimer);
    const row = await prisma.measurement.findUniqueOrThrow({ where: { id: measurementId } });
    expect(row.status).toBe('NORMAL');
    expect((await prisma.$queryRawUnsafe<Array<{ state: string }>>('SELECT "state"::text AS state FROM "Measurement" WHERE "id" = $1', measurementId))[0]?.state).toBe('ANALYSED');
  });

  it('[UC8] [UC10] bench sessions (no patient) never appear in the patient triage queue', async () => {
    const benchRow = await prisma.measurement.create({
      data: {
        deviceId, operatorId: 'u-intern-001', source: 'BENCH', patientId: null,
        idempotencyKey: 'test-queue-bench-001', state: MeasurementState.ANALYSED, status: AlertStatus.BASELINE_BUILDING,
        rejectReason: RejectReason.NONE, captureDurationSec: 25, cleanDurationSec: 24, avgPressureKpa: 5.4, artifactRatioPct: 0,
        rmsValue: 0.15, highLowEnergyRatio: 0.31, dominantFreqHz: 69,
      },
    });
    createdMeasurementIds.push(benchRow.id);
    const queue = await request(app.getHttpServer()).get('/queue').set('Authorization', `Bearer ${nurseToken}`).expect(200);
    expect(queue.body.some((row: { measurementId: string }) => row.measurementId === benchRow.id)).toBe(false);
    expect(queue.body.every((row: { idPseudo: string | null }) => row.idPseudo !== null)).toBe(true);
  });

  it('[UC3] [UC7] INIT and ABANDONED rows stay out of results and do not count toward baseline', async () => {
    const abandoned = await request(app.getHttpServer())
      .post('/measurements').set('Authorization', `Bearer ${nurseToken}`)
      .send({ deviceId, idPseudo: patientPseudo }).expect(201);
    const abandonedId = abandoned.body.measurementId as string;
    createdMeasurementIds.push(abandonedId);
    const before = await request(app.getHttpServer()).get('/queue').set('Authorization', `Bearer ${nurseToken}`).expect(200);
    expect(before.body.some((row: { measurementId: string }) => row.measurementId === abandonedId)).toBe(false);

    await request(app.getHttpServer())
      .post(`/measurements/${abandonedId}/abandon`).set('Authorization', `Bearer ${nurseToken}`)
      .send({ reason: 'Capture interrompue' }).expect(201);
    const abandonedRow = await prisma.measurement.findUniqueOrThrow({ where: { id: abandonedId } });
    expect(abandonedRow.state).toBe(MeasurementState.ABANDONED);
    expect(abandonedRow.status).toBeNull();
    const after = await request(app.getHttpServer()).get('/queue').set('Authorization', `Bearer ${nurseToken}`).expect(200);
    expect(after.body.some((row: { measurementId: string }) => row.measurementId === abandonedId)).toBe(false);

    // Dedicated patient: the shared demo patients keep their own baseline state (demo data must not change).
    await prisma.patientPseudo.upsert({
      where: { id: ISOLATED_PATIENT_ID },
      update: { baselineLocked: false },
      create: { id: ISOLATED_PATIENT_ID, idPseudo: 'PT-TEST-ISO', fistulaType: 'BRACHIO_CEPHALIC', armSide: 'RIGHT', baselineLocked: false },
    });
    const common = {
      patientId: ISOLATED_PATIENT_ID, deviceId, operatorId: 'u-nurse-001', rejectReason: RejectReason.NONE,
      captureDurationSec: 25, cleanDurationSec: 24, avgPressureKpa: 5.4, artifactRatioPct: 0,
      rmsValue: 0.15, highLowEnergyRatio: 0.31, dominantFreqHz: 69,
    };
    await prisma.measurement.create({ data: { ...common, idempotencyKey: baselineFixtureKeys[0], state: MeasurementState.INIT, status: AlertStatus.NORMAL } });
    await prisma.measurement.create({ data: { ...common, idempotencyKey: baselineFixtureKeys[1], state: MeasurementState.ABANDONED, status: AlertStatus.NORMAL } });
    const candidate = await prisma.measurement.create({
      data: { ...common, idempotencyKey: baselineFixtureKeys[2], state: MeasurementState.ANALYSED, status: null },
    });
    await app.get(BaselineService).finalizeMeasurement(candidate.id, 'u-nurse-001', AlertStatus.NORMAL);
    expect((await prisma.patientPseudo.findUniqueOrThrow({ where: { id: ISOLATED_PATIENT_ID } })).baselineLocked).toBe(false);
  });
});

const dspUrl = process.env.DSP_URL ?? 'http://localhost:8010';
const realDspAvailable = await fetch(`${dspUrl.replace(/\/$/, '')}/health`).then((response) => response.ok).catch(() => false);

describe('Real DSP upload [UC6]', () => {
  (realDspAvailable ? it : it.skip)(
    realDspAvailable ? '[UC6] processes simulator capture with real DSP' : '[UC6] skipped: DSP_URL /health did not answer',
    async () => {
    const result = await new DspClient().process(simulatorCapture(), {
      sampleRateAdxl: 1000, sampleRateLis: 200, adxlSamples: 25_000, lisSamples: 5_000,
      pressureSamples: 250, durationSec: 25, avgPressureKpa: 5.4,
    }, {
      thresholdSigma: 3.4, consecutiveAlerts: 2, pressureMinKpa: 2.5, pressureMaxKpa: 9,
      motionThresholdG: 0.08, cleanTimeMinSec: 12, stdFloorPct: 5,
    }, null, 1);
    expect(result.status).toBeDefined();
  });
});
