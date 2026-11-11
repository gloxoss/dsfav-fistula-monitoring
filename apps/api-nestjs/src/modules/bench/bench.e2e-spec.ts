import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { MeasurementSource } from '@prisma/client';
import request from 'supertest';
import { CLINICAL_DISCLAIMER } from '../../common/constants.js';
import { HttpExceptionFilter } from '../../common/http-exception.filter.js';
import { PrismaService } from '../../common/prisma.service.js';
import { BENCH_NOTICE } from './bench.constants.js';
import { BenchModule } from './bench.module.js';

describe('Training bench API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let internToken: string;
  let nephroToken: string;
  let nurseToken: string;
  let adminToken: string;
  const sessionIds: string[] = [];
  const measurementIds: string[] = [];

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function createSession(token = internToken, body: Record<string, unknown> = { pumpFlowMlMin: 450, clampStenosisPct: 50 }) {
    const res = await request(app.getHttpServer())
      .post('/bench/sessions')
      .set(bearer(token))
      .send(body)
      .expect(201);
    sessionIds.push(res.body.id);
    return res.body;
  }

  async function analysedBenchMeasurement() {
    const row = await prisma.measurement.create({
      data: {
        source: MeasurementSource.BENCH,
        patientId: null,
        deviceId: 'dev-01-001',
        operatorId: 'u-intern-001',
        captureDurationSec: 25,
        cleanDurationSec: 24,
        avgPressureKpa: 5.1,
        artifactRatioPct: 1.2,
        rmsValue: 0.16,
      },
    });
    measurementIds.push(row.id);
    return row;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [BenchModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    internToken = jwt.sign({ sub: 'u-intern-001', email: 'intern@dsfav.local', role: 'INTERN' });
    nephroToken = jwt.sign({ sub: 'u-nephro-001', email: 'nephro@dsfav.local', role: 'NEPHROLOGIST' });
    nurseToken = jwt.sign({ sub: 'u-nurse-001', email: 'nurse@dsfav.local', role: 'NURSE' });
    adminToken = jwt.sign({ sub: 'u-admin-001', email: 'admin@dsfav.local', role: 'ADMIN' });
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      if (sessionIds.length > 0) {
        await prisma.benchSession.deleteMany({ where: { id: { in: sessionIds } } });
      }
      if (measurementIds.length > 0) {
        await prisma.measurement.deleteMany({ where: { id: { in: measurementIds } } });
      }
    }
    await app.close();
  }, 30000);

  it('[UC10] full bench flow stores a BenchSession with source BENCH and no patient', async () => {
    const session = await createSession();
    expect(session.benchNotice).toBe(BENCH_NOTICE);
    expect(session.pumpFlowMlMin).toBe(450);
    expect(session.clampStenosisPct).toBe(50);
    expect(session.measurementId).toBeNull();

    const palpation = await request(app.getHttpServer())
      .post(`/bench/sessions/${session.id}/palpation`)
      .set(bearer(internToken))
      .send({
        perceivedThrill: 'SYSTOLIC_ROUGH',
        perceivedIntensity: 3,
        internNotes: 'Frémissement perçu en systole',
      })
      .expect(200);
    expect(palpation.body).toMatchObject({
      id: session.id,
      perceivedThrill: 'SYSTOLIC_ROUGH',
      perceivedIntensity: 3,
      benchNotice: BENCH_NOTICE,
    });

    const measurement = await analysedBenchMeasurement();
    const capture = await request(app.getHttpServer())
      .post(`/bench/sessions/${session.id}/capture`)
      .set(bearer(internToken))
      .send({ measurementId: measurement.id })
      .expect(200);

    expect(capture.body).toMatchObject({
      sessionId: session.id,
      internId: 'u-intern-001',
      measurementId: measurement.id,
      perceivedThrill: 'SYSTOLIC_ROUGH',
      perceivedIntensity: 3,
      benchNotice: BENCH_NOTICE,
      disclaimer: CLINICAL_DISCLAIMER,
    });
    expect(typeof capture.body.concordanceScore).toBe('number');
    expect(capture.body.expectedProfile).toBeDefined();
    expect(capture.body.concordanceBreakdown).toMatchObject({
      sensationScorePct: expect.any(Number),
      intensityScorePct: expect.any(Number),
      notesScorePct: 15,
    });

    const stored = await prisma.benchSession.findUniqueOrThrow({
      where: { id: session.id },
      include: { measurement: true },
    });
    expect(stored.measurementId).toBe(measurement.id);
    expect(stored.palpationLockedAt).not.toBeNull();
    expect(stored.concordanceScore).not.toBeNull();
    expect(stored.measurement?.source).toBe('BENCH');
    expect(stored.measurement?.patientId).toBeNull();
  });

  it('[UC11] capture before palpation -> 409 « Décrivez d’abord votre palpation » and no objective data', async () => {
    const session = await createSession(internToken, { pumpFlowMlMin: 450, clampStenosisPct: 30 });
    const measurement = await analysedBenchMeasurement();

    const res = await request(app.getHttpServer())
      .post(`/bench/sessions/${session.id}/capture`)
      .set(bearer(internToken))
      .send({ measurementId: measurement.id })
      .expect(409);

    expect(res.body).toMatchObject({
      code: 'PALPATION_REQUIRED',
      message_fr: 'Décrivez d’abord votre palpation',
      retryable: false,
    });
    expect(res.body.concordanceScore).toBeUndefined();
    expect(res.body.expectedProfile).toBeUndefined();
    expect(res.body.concordanceBreakdown).toBeUndefined();

    const stored = await prisma.benchSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(stored.measurementId).toBeNull();
    expect(stored.concordanceScore).toBeNull();
  });

  it('[UC11] concurrent captures claim one measurement atomically', async () => {
    const session = await createSession();
    await request(app.getHttpServer())
      .post(`/bench/sessions/${session.id}/palpation`)
      .set(bearer(internToken))
      .send({ perceivedThrill: 'SYSTOLIC_ROUGH', perceivedIntensity: 3 })
      .expect(200);

    const firstMeasurement = await analysedBenchMeasurement();
    const secondMeasurement = await analysedBenchMeasurement();
    const [first, second] = await Promise.all(
      [firstMeasurement, secondMeasurement].map((measurement) =>
        request(app.getHttpServer())
          .post(`/bench/sessions/${session.id}/capture`)
          .set(bearer(internToken))
          .send({ measurementId: measurement.id }),
      ),
    );

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const winner = first.status === 200 ? firstMeasurement : secondMeasurement;
    expect(first.status === 200 ? first.body.measurementId : second.body.measurementId).toBe(winner.id);
    expect(first.status === 409 ? first.body : second.body).toMatchObject({
      code: 'BENCH_ALREADY_CAPTURED',
      retryable: false,
    });
    const stored = await prisma.benchSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(stored.measurementId).toBe(winner.id);
  });

  it('[UC11] concurrent palpations preserve the first locked answer', async () => {
    const session = await createSession();
    const [first, second] = await Promise.all(
      [
        { perceivedThrill: 'SYSTOLIC_ROUGH', perceivedIntensity: 3 },
        { perceivedThrill: 'CONTINUOUS_SOFT', perceivedIntensity: 2 },
      ].map((answer) =>
        request(app.getHttpServer())
          .post(`/bench/sessions/${session.id}/palpation`)
          .set(bearer(internToken))
          .send(answer),
      ),
    );

    expect([first.status, second.status].sort()).toEqual([200, 400]);
    const winner = first.status === 200 ? first.body : second.body;
    const stored = await prisma.benchSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(stored.palpationLockedAt).not.toBeNull();
    expect(stored.perceivedThrill).toBe(winner.perceivedThrill);
    expect(stored.perceivedIntensity).toBe(winner.perceivedIntensity);
  });

  it('[UC10] every bench response carries « Simulation sur banc, pas de donnée patient »', async () => {
    const session = await createSession();
    expect(session.benchNotice).toBe(BENCH_NOTICE);

    const palpation = await request(app.getHttpServer())
      .post(`/bench/sessions/${session.id}/palpation`)
      .set(bearer(internToken))
      .send({ perceivedThrill: 'CONTINUOUS_SOFT', perceivedIntensity: 2 })
      .expect(200);
    expect(palpation.body.benchNotice).toBe(BENCH_NOTICE);

    const measurement = await analysedBenchMeasurement();
    const capture = await request(app.getHttpServer())
      .post(`/bench/sessions/${session.id}/capture`)
      .set(bearer(internToken))
      .send({ measurementId: measurement.id })
      .expect(200);
    expect(capture.body.benchNotice).toBe(BENCH_NOTICE);

    const list = await request(app.getHttpServer())
      .get('/bench/sessions')
      .set(bearer(internToken))
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBeGreaterThan(0);
    for (const item of list.body) {
      expect(item.benchNotice).toBe(BENCH_NOTICE);
    }
  });

  it('[AUTHZ-MATRIX] intern trains, nephrologist reads, nurse and admin are refused', async () => {
    await request(app.getHttpServer()).get('/bench/sessions').set(bearer(internToken)).expect(200);
    await request(app.getHttpServer()).get('/bench/sessions').set(bearer(nephroToken)).expect(200);
    await request(app.getHttpServer()).get('/bench/sessions').set(bearer(nurseToken)).expect(403);
    await request(app.getHttpServer()).get('/bench/sessions').set(bearer(adminToken)).expect(403);

    await request(app.getHttpServer())
      .post('/bench/sessions')
      .set(bearer(nurseToken))
      .send({ pumpFlowMlMin: 450, clampStenosisPct: 0 })
      .expect(403);
    await request(app.getHttpServer())
      .post('/bench/sessions')
      .set(bearer(adminToken))
      .send({ pumpFlowMlMin: 450, clampStenosisPct: 0 })
      .expect(403);
    await request(app.getHttpServer())
      .post('/bench/sessions')
      .set(bearer(nephroToken))
      .send({ pumpFlowMlMin: 450, clampStenosisPct: 0 })
      .expect(403);
  });

  it('[UC10] rejects invalid bench settings and unknown sessions', async () => {
    await request(app.getHttpServer())
      .post('/bench/sessions')
      .set(bearer(internToken))
      .send({ pumpFlowMlMin: 450, clampStenosisPct: 42 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/bench/sessions/00000000-0000-4000-8000-000000000000/palpation')
      .set(bearer(internToken))
      .send({ perceivedThrill: 'ABSENT', perceivedIntensity: 1 })
      .expect(404);
  });

  it('[UC10] [UC11] imports synthetic CSV and returns its concordance report', async () => {
    const csvContent = [
      'clamp_stenosis_pct,pump_flow_ml_min,perceived_thrill,perceived_intensity,measured_intensity_level',
      '0,450,CONTINUOUS_SOFT,3,3',
    ].join('\n');
    const report = await request(app.getHttpServer())
      .post('/bench/reports/import')
      .set(bearer(internToken))
      .send({ csvContent })
      .expect(200);
    expect(report.body).toMatchObject({ synthetic: true, rowCount: 1, meanConcordancePct: 85, disclaimer: CLINICAL_DISCLAIMER });
  });

  it('[PSEUDO-SCAN] refuses personal-data columns in imported bench CSV', async () => {
    await request(app.getHttpServer())
      .post('/bench/reports/import')
      .set(bearer(internToken))
      .send({ csvContent: 'clamp_stenosis_pct,pump_flow_ml_min,perceived_thrill,perceived_intensity,measured_intensity_level,nom\n0,450,CONTINUOUS_SOFT,3,3,Exemple' })
      .expect(400);
  });
});
