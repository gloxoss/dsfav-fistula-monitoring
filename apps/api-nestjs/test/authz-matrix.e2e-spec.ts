import { DsfavWsAdapter } from '../src/realtime/dsfav-ws.adapter.js';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/http-exception.filter.js';
import { CLINICAL_DISCLAIMER } from '../src/common/constants.js';
import { PrismaService } from '../src/common/prisma.service.js';

import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants.js';
import { RequestMethod } from '@nestjs/common';

const AUTHZ_MEASUREMENT_KEY = 'test-authz-matrix-001';
const SEEDED_PATIENT_PSEUDO = 'PT-CAS-8841';
const SEEDED_BASELINE_ID = 'bv-8841-001';

describe('Auth & Authorization Matrix (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let nurseToken: string;
  let nephroToken: string;
  let internToken: string;
  let adminToken: string;
  let seededPatientId: string;
  let authzMeasurementId: string;
  const createdMeasurementIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new DsfavWsAdapter(app));
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up test patient PT-CAS-9277 to guarantee test idempotency
    await prisma.patientPseudo.deleteMany({ where: { idPseudo: 'PT-CAS-9277' } });

    const seededPatient = await prisma.patientPseudo.findUniqueOrThrow({
      where: { idPseudo: SEEDED_PATIENT_PSEUDO },
    });
    seededPatientId = seededPatient.id;

    // Reset any leftover fixture from a crashed run, then create the measurement
    // the clinical-note/follow-up-intent rows attach to (the seed ships none).
    const staleFixture = await prisma.measurement.findUnique({
      where: { idempotencyKey: AUTHZ_MEASUREMENT_KEY },
    });
    if (staleFixture) {
      await prisma.followUpIntent.deleteMany({ where: { measurementId: staleFixture.id } });
      await prisma.clinicalNote.deleteMany({ where: { measurementId: staleFixture.id } });
      await prisma.measurement.deleteMany({ where: { id: staleFixture.id } });
    }
    const fixture = await prisma.measurement.create({
      data: {
        patientId: seededPatientId,
        deviceId: 'dev-01-001',
        operatorId: 'u-nurse-001',
        captureDurationSec: 25,
        cleanDurationSec: 23.5,
        avgPressureKpa: 5.2,
        artifactRatioPct: 2.1,
        idempotencyKey: AUTHZ_MEASUREMENT_KEY,
      },
    });
    authzMeasurementId = fixture.id;

    // Acquire tokens for seeded users
    const nurseRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nurse@dsfav.local', password: 'demo1234' });
    nurseToken = nurseRes.body.token;

    const nephroRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nephro@dsfav.local', password: 'demo1234' });
    nephroToken = nephroRes.body.token;

    const internRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'intern@dsfav.local', password: 'demo1234' });
    internToken = internRes.body.token;

    const adminRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@dsfav.local', password: 'demo1234' });
    adminToken = adminRes.body.token;
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      // Reset PT-CAS-8841 to the seeded state after the rebaseline tests
      await prisma.patientPseudo.updateMany({
        where: { idPseudo: SEEDED_PATIENT_PSEUDO },
        data: { baselineLocked: true },
      });
      await prisma.baselineVersion.updateMany({
        where: { id: SEEDED_BASELINE_ID },
        data: { active: true, archivedAt: null },
      });
      await prisma.patientPseudo.deleteMany({ where: { idPseudo: 'PT-CAS-9277' } });
      // Remove the test fixtures (append-only audit rows kept, by design)
      if (authzMeasurementId) {
        await prisma.followUpIntent.deleteMany({ where: { measurementId: authzMeasurementId } });
        await prisma.clinicalNote.deleteMany({ where: { measurementId: authzMeasurementId } });
        await prisma.measurement.deleteMany({ where: { id: authzMeasurementId } });
      }
      if (createdMeasurementIds.length) {
        await prisma.measurement.deleteMany({ where: { id: { in: createdMeasurementIds } } });
      }
      await prisma.clinicalNote.deleteMany({
        where: { patientId: seededPatientId, authorId: 'u-nephro-001', text: 'Note de test' },
      });
    }
    await app.close();
  }, 30000);

  describe('Authentication [AUTHZ-MATRIX]', () => {
    it('[AUTHZ-MATRIX] enumerates real AppModule routes and verifies token gate and role access for EVERY route', async () => {
      const discovery = app.get(DiscoveryService);
      const controllers = discovery.getControllers();
      const routes: Array<{ method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; path: string; key: string }> = [];

      const methodNames: Record<number, 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'> = {
        [RequestMethod.GET]: 'GET',
        [RequestMethod.POST]: 'POST',
        [RequestMethod.PUT]: 'PUT',
        [RequestMethod.DELETE]: 'DELETE',
        [RequestMethod.PATCH]: 'PATCH',
      };

      for (const wrapper of controllers) {
        const { metatype, instance } = wrapper;
        if (!metatype || !instance) continue;
        const controllerPath = Reflect.getMetadata(PATH_METADATA, metatype) ?? '';
        const prototype = Object.getPrototypeOf(instance);
        const propNames = Object.getOwnPropertyNames(prototype);

        for (const prop of propNames) {
          if (prop === 'constructor') continue;
          const methodRef = prototype[prop];
          if (typeof methodRef !== 'function') continue;
          const routePath = Reflect.getMetadata(PATH_METADATA, methodRef);
          const requestMethod = Reflect.getMetadata(METHOD_METADATA, methodRef);
          if (routePath !== undefined && requestMethod !== undefined) {
            const rawPath = `${controllerPath}/${routePath}`
              .replace(/\/+/g, '/')
              .replace(/\/$/, '');
            const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
            const method = methodNames[requestMethod] ?? 'GET';
            routes.push({
              method,
              path: normalizedPath,
              key: `${method} ${normalizedPath}`,
            });
          }
        }
      }

      type RoleExpectation = {
        NURSE: boolean;
        NEPHROLOGIST: boolean;
        INTERN: boolean;
        ADMIN: boolean;
      };

      const ROUTE_AUTHZ_EXPECTATIONS: Record<string, RoleExpectation> = {
        'GET /health': { NURSE: true, NEPHROLOGIST: true, INTERN: true, ADMIN: true },
        'POST /auth/login': { NURSE: true, NEPHROLOGIST: true, INTERN: true, ADMIN: true },
        'GET /me': { NURSE: true, NEPHROLOGIST: true, INTERN: true, ADMIN: true },
        'GET /patients': { NURSE: true, NEPHROLOGIST: true, INTERN: false, ADMIN: false },
        'POST /patients': { NURSE: true, NEPHROLOGIST: true, INTERN: false, ADMIN: false },
        'GET /patients/:idPseudo': { NURSE: true, NEPHROLOGIST: true, INTERN: false, ADMIN: false },
        'GET /patients/:idPseudo/history': { NURSE: true, NEPHROLOGIST: true, INTERN: false, ADMIN: false },
        'POST /patients/:idPseudo/rebaseline': { NURSE: false, NEPHROLOGIST: true, INTERN: false, ADMIN: false },
        'POST /patients/:idPseudo/notes': { NURSE: false, NEPHROLOGIST: true, INTERN: false, ADMIN: false },
        'GET /patients/:idPseudo/notes': { NURSE: false, NEPHROLOGIST: true, INTERN: false, ADMIN: false },
        'GET /patients/:idPseudo/follow-ups': { NURSE: false, NEPHROLOGIST: true, INTERN: false, ADMIN: false },
        'GET /patients/:idPseudo/baseline-versions': { NURSE: false, NEPHROLOGIST: true, INTERN: false, ADMIN: false },
        'POST /patients/:idPseudo/follow-up-intents': { NURSE: false, NEPHROLOGIST: true, INTERN: false, ADMIN: false },
        'POST /measurements': { NURSE: true, NEPHROLOGIST: false, INTERN: true, ADMIN: false },
        'PUT /measurements/:id/raw': { NURSE: true, NEPHROLOGIST: false, INTERN: true, ADMIN: false },
        'POST /measurements/:id/abandon': { NURSE: true, NEPHROLOGIST: false, INTERN: true, ADMIN: false },
        'GET /queue': { NURSE: true, NEPHROLOGIST: true, INTERN: false, ADMIN: false },
        'GET /measurements/:id': { NURSE: true, NEPHROLOGIST: true, INTERN: false, ADMIN: false },
        'GET /audit': { NURSE: false, NEPHROLOGIST: true, INTERN: false, ADMIN: true },
        'GET /config/active': { NURSE: true, NEPHROLOGIST: true, INTERN: false, ADMIN: true },
        'POST /config/threshold-proposals': { NURSE: false, NEPHROLOGIST: true, INTERN: false, ADMIN: false },
        'POST /config/threshold-proposals/:id/approve': { NURSE: false, NEPHROLOGIST: true, INTERN: false, ADMIN: false },
        'GET /devices': { NURSE: true, NEPHROLOGIST: true, INTERN: false, ADMIN: true },
        'GET /devices/:id': { NURSE: true, NEPHROLOGIST: true, INTERN: false, ADMIN: true },
        'POST /devices/:id/calibration': { NURSE: false, NEPHROLOGIST: false, INTERN: false, ADMIN: true },
        'POST /devices/sync': { NURSE: true, NEPHROLOGIST: false, INTERN: false, ADMIN: false },
        'POST /sync-queue/:id/retry': { NURSE: true, NEPHROLOGIST: false, INTERN: false, ADMIN: false },
        'GET /bench/sessions': { NURSE: false, NEPHROLOGIST: true, INTERN: true, ADMIN: false },
        'POST /bench/sessions': { NURSE: false, NEPHROLOGIST: false, INTERN: true, ADMIN: false },
        'POST /bench/sessions/:id/palpation': { NURSE: false, NEPHROLOGIST: false, INTERN: true, ADMIN: false },
        'POST /bench/sessions/:id/capture': { NURSE: false, NEPHROLOGIST: false, INTERN: true, ADMIN: false },
        'POST /bench/reports/import': { NURSE: false, NEPHROLOGIST: false, INTERN: true, ADMIN: false },
        'GET /users': { NURSE: false, NEPHROLOGIST: false, INTERN: false, ADMIN: true },
      };

      const tokens: Record<keyof RoleExpectation, string> = {
        NURSE: nurseToken,
        NEPHROLOGIST: nephroToken,
        INTERN: internToken,
        ADMIN: adminToken,
      };

      function resolveUrl(pattern: string): string {
        return pattern
          .replace(':idPseudo', SEEDED_PATIENT_PSEUDO)
          .replace(':id', authzMeasurementId || 'dev-01-001');
      }

      function makeRequest(method: string, url: string, token?: string) {
        const req = (request(app.getHttpServer()) as any)[method.toLowerCase()](url);
        if (token) {
          req.set('Authorization', `Bearer ${token}`);
        }
        return req;
      }

      for (const r of routes) {
        const expected = ROUTE_AUTHZ_EXPECTATIONS[r.key];
        if (!expected) {
          throw new Error(`[AUTHZ-MATRIX] New route '${r.key}' has no entry in ROUTE_AUTHZ_EXPECTATIONS!`);
        }

        const url = resolveUrl(r.path);

        // 1. Without token: must be 401 except for public endpoints
        if (r.key === 'GET /health' || r.key === 'POST /auth/login') {
          const res = await makeRequest(r.method, url);
          expect(res.status).not.toBe(401);
        } else {
          const res = await makeRequest(r.method, url);
          expect(res.status).toBe(401);
          expect(res.body).toMatchObject({
            code: 'UNAUTHORIZED',
            retryable: false,
          });
        }

        // 2. Role tokens: test every role against the route
        for (const [role, token] of Object.entries(tokens) as Array<[keyof RoleExpectation, string]>) {
          const allowed = expected[role];
          const res = await makeRequest(r.method, url, token);
          if (allowed) {
            if (res.status === 401 || res.status === 403) {
              throw new Error(`[AUTHZ-MATRIX] Route '${r.key}' should be ALLOWED for ${role}, but received ${res.status}: ${JSON.stringify(res.body)}`);
            }
          } else {
            if (res.status !== 403) {
              throw new Error(`[AUTHZ-MATRIX] Route '${r.key}' should be FORBIDDEN (403) for ${role}, but received ${res.status}: ${JSON.stringify(res.body)}`);
            }
            expect(res.body).toMatchObject({
              code: 'FORBIDDEN',
              retryable: false,
            });
          }
        }
      }
    }, 30000);

    it('[AUTHZ-MATRIX] PrismaService runs real SQL against the seeded database', async () => {
      const rows = (await prisma.$queryRawUnsafe(
        'SELECT count(*)::int AS count FROM "User"',
      )) as Array<{ count: number }>;
      expect(rows[0]?.count).toBeGreaterThanOrEqual(4);
    });

    it('[AUTHZ-MATRIX] wrong password -> 401 with message_fr and code INVALID_CREDENTIALS', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nurse@dsfav.local', password: 'wrongpassword' })
        .expect(401);

      expect(res.body).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message_fr: expect.any(String),
        retryable: false,
      });
    });

    it('GET /me returns authenticated user profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        email: 'nurse@dsfav.local',
        role: 'NURSE',
      });
    });

    it('GET /me without token returns 401 UNAUTHORIZED with message_fr', async () => {
      const res = await request(app.getHttpServer())
        .get('/me')
        .expect(401);

      expect(res.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message_fr: expect.any(String),
        retryable: false,
      });
    });
  });

  describe('Patients Registration & Lookup [UC5]', () => {
    it('[UC5] GET /patients/PT-CAS-9277 -> 404 with code PATIENT_UNKNOWN', async () => {
      const res = await request(app.getHttpServer())
        .get('/patients/PT-CAS-9277')
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(404);

      expect(res.body).toMatchObject({
        code: 'PATIENT_UNKNOWN',
        message_fr: expect.any(String),
        retryable: false,
      });
    });

    it('[UC5] POST /patients creates it with fistulaType and armSide from the body', async () => {
      const res = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          idPseudo: 'PT-CAS-9277',
          fistulaType: 'RADIO_CEPHALIC',
          armSide: 'RIGHT',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        idPseudo: 'PT-CAS-9277',
        fistulaType: 'RADIO_CEPHALIC',
        armSide: 'RIGHT',
        baselineLocked: false,
      });
    });

    it('[UC5] GET /patients/PT-CAS-9277 now returns the newly created patient', async () => {
      const res = await request(app.getHttpServer())
        .get('/patients/PT-CAS-9277')
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        idPseudo: 'PT-CAS-9277',
        fistulaType: 'RADIO_CEPHALIC',
        armSide: 'RIGHT',
      });
    });

    it('[AUTHZ-MATRIX] intern cannot directly look up a patient -> 403', async () => {
      await request(app.getHttpServer())
        .get('/patients/PT-CAS-8841')
        .set('Authorization', `Bearer ${internToken}`)
        .expect(403);
    });

    it('[AUTHZ-MATRIX] admin cannot directly look up a patient -> 403', async () => {
      await request(app.getHttpServer())
        .get('/patients/PT-CAS-8841')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('[AUTHZ-MATRIX] nurse can directly look up a patient -> 200', async () => {
      await request(app.getHttpServer())
        .get('/patients/PT-CAS-8841')
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(200);
    });

    it('[AUTHZ-MATRIX] nephrologist can directly look up a patient -> 200', async () => {
      await request(app.getHttpServer())
        .get('/patients/PT-CAS-8841')
        .set('Authorization', `Bearer ${nephroToken}`)
        .expect(200);
    });

    it('[UC5] invalid patient DTO fields are rejected', async () => {
      const res = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ idPseudo: '', fistulaType: 'INVALID', armSide: 'NORTH' })
        .expect(400);

      expect(res.body.message_fr).toEqual(expect.any(String));
    });

    it('GET /patients returns patient summaries including baseline state and lastStatus', async () => {
      const res = await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const pt8841 = res.body.find((p: any) => p.idPseudo === 'PT-CAS-8841');
      expect(pt8841).toBeDefined();
      expect(pt8841.baselineLocked).toBe(true);
    });

    it('[AUTHZ-MATRIX] nephrologist can view patient queue -> 200', async () => {
      await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${nephroToken}`)
        .expect(200);
    });

    it('[AUTHZ-MATRIX] intern cannot view patient queue -> 403', async () => {
      await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${internToken}`)
        .expect(403);
    });

    it('[AUTHZ-MATRIX] admin cannot view patient queue -> 403', async () => {
      await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });

  describe('Authorization Matrix by Role [AUTHZ-MATRIX]', () => {
    // 1. Patient history: Nurse & Nephro yes, Intern & Admin no
    it('[AUTHZ-MATRIX] intern cannot read patient history -> 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/patients/PT-CAS-8841/history')
        .set('Authorization', `Bearer ${internToken}`)
        .expect(403);

      expect(res.body).toMatchObject({
        code: 'FORBIDDEN',
        message_fr: expect.any(String),
        retryable: false,
      });
    });

    it('[AUTHZ-MATRIX] admin cannot read patient history -> 403', async () => {
      await request(app.getHttpServer())
        .get('/patients/PT-CAS-8841/history')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('[AUTHZ-MATRIX] nurse can read patient history -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/patients/PT-CAS-8841/history')
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        idPseudo: 'PT-CAS-8841',
        disclaimer: CLINICAL_DISCLAIMER,
      });
    });

    it('[AUTHZ-MATRIX] nephrologist can read patient history -> 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/patients/PT-CAS-8841/history')
        .set('Authorization', `Bearer ${nephroToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        idPseudo: 'PT-CAS-8841',
        disclaimer: CLINICAL_DISCLAIMER,
      });
    });

    it('[AUTHZ-MATRIX] nurse cannot add clinical note -> 403', async () => {
      await request(app.getHttpServer())
        .post('/patients/PT-CAS-8841/notes')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ text: 'Note infirmier' })
        .expect(403);
    });

    it('[AUTHZ-MATRIX] intern cannot add clinical note -> 403', async () => {
      await request(app.getHttpServer())
        .post('/patients/PT-CAS-8841/notes')
        .set('Authorization', `Bearer ${internToken}`)
        .send({ text: 'Note interne' })
        .expect(403);
    });

    it('[AUTHZ-MATRIX] admin cannot add clinical note -> 403', async () => {
      await request(app.getHttpServer())
        .post('/patients/PT-CAS-8841/notes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'Note admin' })
        .expect(403);
    });

    // 2. Re-baseline: Nephrologist yes, Nurse no, Intern no, Admin no
    it('[AUTHZ-MATRIX] nurse cannot rebaseline -> 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/patients/PT-CAS-8841/rebaseline')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ reason: 'Tentative de rebaseline' })
        .expect(403);

      expect(res.body).toMatchObject({
        code: 'FORBIDDEN',
        message_fr: expect.any(String),
        retryable: false,
      });
    });

    it('[AUTHZ-MATRIX] nephrologist can rebaseline -> 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/patients/PT-CAS-8841/rebaseline')
        .set('Authorization', `Bearer ${nephroToken}`)
        .send({ reason: 'Revue clinique post-angioplastie' })
        .expect(200);

      expect(res.body).toMatchObject({
        idPseudo: 'PT-CAS-8841',
        status: 'BASELINE_BUILDING',
      });
    });

    it('[AUTHZ-MATRIX] intern cannot rebaseline -> 403', async () => {
      await request(app.getHttpServer())
        .post('/patients/PT-CAS-8841/rebaseline')
        .set('Authorization', `Bearer ${internToken}`)
        .send({ reason: 'Tentative interne' })
        .expect(403);
    });

    it('[AUTHZ-MATRIX] admin cannot rebaseline -> 403', async () => {
      await request(app.getHttpServer())
        .post('/patients/PT-CAS-8841/rebaseline')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Tentative admin' })
        .expect(403);
    });

    it('[AUTHZ-MATRIX] nurse creates patient measurement in INIT state', async () => {
      const res = await request(app.getHttpServer())
        .post('/measurements')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ deviceId: 'dev-01-001', idPseudo: SEEDED_PATIENT_PSEUDO })
        .expect(201);
      createdMeasurementIds.push(res.body.measurementId);
      expect(res.body.state).toBe('INIT');
      const row = await prisma.measurement.findUniqueOrThrow({ where: { id: res.body.measurementId } });
      expect(row.status).toBeNull();
      expect((await prisma.$queryRawUnsafe<Array<{ state: string }>>('SELECT "state"::text AS state FROM "Measurement" WHERE "id" = $1', row.id))[0]?.state).toBe('INIT');
    });

    it.each([
      ['intern', () => internToken],
      ['nephrologist', () => nephroToken],
      ['admin', () => adminToken],
    ])('[AUTHZ-MATRIX] %s cannot create patient measurement', async (_role, token) => {
      await request(app.getHttpServer())
        .post('/measurements')
        .set('Authorization', `Bearer ${token()}`)
        .send({ deviceId: 'dev-01-001', idPseudo: SEEDED_PATIENT_PSEUDO })
        .expect(403);
    });

    it('[AUTHZ-MATRIX] intern may create only a bench measurement without patient id', async () => {
      const res = await request(app.getHttpServer())
        .post('/measurements')
        .set('Authorization', `Bearer ${internToken}`)
        .send({ deviceId: 'dev-01-001', source: 'BENCH' })
        .expect(201);
      createdMeasurementIds.push(res.body.measurementId);
      expect(res.body.state).toBe('INIT');
    });

    it('[AUTHZ-MATRIX] nurse can view queue and measurement detail', async () => {
      await request(app.getHttpServer()).get('/queue').set('Authorization', `Bearer ${nurseToken}`).expect(200);
      await request(app.getHttpServer()).get(`/measurements/${authzMeasurementId}`).set('Authorization', `Bearer ${nurseToken}`).expect(200);
    });

    it('[AUTHZ-MATRIX] nephrologist can view queue and measurement detail', async () => {
      await request(app.getHttpServer()).get('/queue').set('Authorization', `Bearer ${nephroToken}`).expect(200);
      await request(app.getHttpServer()).get(`/measurements/${authzMeasurementId}`).set('Authorization', `Bearer ${nephroToken}`).expect(200);
    });

    it.each([
      ['intern', () => internToken],
      ['admin', () => adminToken],
    ])('[AUTHZ-MATRIX] %s cannot view queue or measurement detail', async (_role, token) => {
      await request(app.getHttpServer()).get('/queue').set('Authorization', `Bearer ${token()}`).expect(403);
      await request(app.getHttpServer()).get(`/measurements/${authzMeasurementId}`).set('Authorization', `Bearer ${token()}`).expect(403);
    });

    it('[AUTHZ-MATRIX] nurse cannot write clinical notes -> 403', async () => {
      await request(app.getHttpServer())
        .post('/patients/PT-CAS-8841/notes')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ text: 'Note de test' })
        .expect(403);
    });

    it('[AUTHZ-MATRIX] nephrologist can write clinical notes and audit the write', async () => {
      const res = await request(app.getHttpServer())
        .post('/patients/PT-CAS-8841/notes')
        .set('Authorization', `Bearer ${nephroToken}`)
        .send({ text: 'Note de test' })
        .expect(201);

      expect(res.body.text).toBe('Note de test');
      expect(await prisma.auditEvent.count({ where: { action: 'CLINICAL_NOTE_CREATED', entityId: res.body.id } })).toBe(1);
    });

    it('[AUTHZ-MATRIX] nurse cannot record follow-up intent -> 403', async () => {
      await request(app.getHttpServer())
        .post('/patients/PT-CAS-8841/follow-up-intents')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ measurementId: 'missing-measurement' })
        .expect(403);
    });

    it('[AUTHZ-MATRIX] nephrologist can record follow-up intent and audit the write', async () => {
      const res = await request(app.getHttpServer())
        .post('/patients/PT-CAS-8841/follow-up-intents')
        .set('Authorization', `Bearer ${nephroToken}`)
        .send({ measurementId: authzMeasurementId, reason: 'Contrôle' })
        .expect(201);

      expect(res.body.measurementId).toBe(authzMeasurementId);
      expect(await prisma.auditEvent.count({ where: { action: 'FOLLOW_UP_INTENT_CREATED', entityId: res.body.id } })).toBe(1);
    });

    it('[AUTHZ-MATRIX] intern cannot record follow-up intent -> 403', async () => {
      await request(app.getHttpServer())
        .post('/patients/PT-CAS-8841/follow-up-intents')
        .set('Authorization', `Bearer ${internToken}`)
        .send({ measurementId: 'missing-measurement' })
        .expect(403);
    });

    it('[AUTHZ-MATRIX] admin cannot record follow-up intent -> 403', async () => {
      await request(app.getHttpServer())
        .post('/patients/PT-CAS-8841/follow-up-intents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ measurementId: 'missing-measurement' })
        .expect(403);
    });

    // 4. Bench training: Intern yes, Nephro read only, Nurse no, Admin no
    it('[AUTHZ-MATRIX] nurse cannot train on bench -> 403', async () => {
      await request(app.getHttpServer())
        .post('/bench/sessions')
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(403);
    });

    it('[AUTHZ-MATRIX] intern can train on bench -> 200 or 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/bench/sessions')
        .set('Authorization', `Bearer ${internToken}`)
        .send({ pumpFlowMlMin: 600, clampStenosisPct: 50 });

      expect([200, 201]).toContain(res.status);
    });

    it('[AUTHZ-MATRIX] nephrologist can read bench sessions -> 200', async () => {
      await request(app.getHttpServer())
        .get('/bench/sessions')
        .set('Authorization', `Bearer ${nephroToken}`)
        .expect(200);
    });

    it('[AUTHZ-MATRIX] admin cannot train on bench -> 403', async () => {
      await request(app.getHttpServer())
        .post('/bench/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('[AUTHZ-MATRIX] nurse cannot read bench sessions -> 403', async () => {
      await request(app.getHttpServer())
        .get('/bench/sessions')
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(403);
    });

    it('[AUTHZ-MATRIX] intern can read bench sessions -> 200', async () => {
      await request(app.getHttpServer())
        .get('/bench/sessions')
        .set('Authorization', `Bearer ${internToken}`)
        .expect(200);
    });

    it('[AUTHZ-MATRIX] admin cannot read bench sessions -> 403', async () => {
      await request(app.getHttpServer())
        .get('/bench/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    // 5. Device list & calibration: Admin yes, Nurse/Nephro view only, Intern no
    it('[AUTHZ-MATRIX] intern cannot view devices -> 403', async () => {
      await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', `Bearer ${internToken}`)
        .expect(403);
    });

    it('[AUTHZ-MATRIX] nurse can view devices -> 200', async () => {
      await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(200);
    });

    it('[AUTHZ-MATRIX] nephrologist can view devices -> 200', async () => {
      await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', `Bearer ${nephroToken}`)
        .expect(200);
    });

    it('[AUTHZ-MATRIX] admin can view devices -> 200', async () => {
      await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('[AUTHZ-MATRIX] nurse cannot start calibration -> 403', async () => {
      await request(app.getHttpServer())
        .post('/devices/dev-01-001/calibration')
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(403);
    });

    it('[AUTHZ-MATRIX] admin can start calibration -> 200', async () => {
      await request(app.getHttpServer())
        .post('/devices/dev-01-001/calibration')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ calibrationGain: 1, reason: "controle banc" })
        .expect(200);
    });

    it('[AUTHZ-MATRIX] nephrologist cannot start calibration -> 403', async () => {
      await request(app.getHttpServer())
        .post('/devices/dev-01-001/calibration')
        .set('Authorization', `Bearer ${nephroToken}`)
        .expect(403);
    });

    it('[AUTHZ-MATRIX] intern cannot start calibration -> 403', async () => {
      await request(app.getHttpServer())
        .post('/devices/dev-01-001/calibration')
        .set('Authorization', `Bearer ${internToken}`)
        .expect(403);
    });

    // Deferred routes are intentionally outside the frozen v1 contract.
    it.skip('[AUTHZ-DEFERRED] admin config publish, route not in the v1 contract (settings editing is out of v1 scope, PRD section 7)', async () => {});
    it.skip('[AUTHZ-DEFERRED] nurse config publish, route not in the v1 contract (settings editing is out of v1 scope, PRD section 7)', async () => {});
    it.skip('[AUTHZ-DEFERRED] nephrologist config publish, route not in the v1 contract (settings editing is out of v1 scope, PRD section 7)', async () => {});
    it.skip('[AUTHZ-DEFERRED] intern config publish, route not in the v1 contract (settings editing is out of v1 scope, PRD section 7)', async () => {});
    it.skip('[AUTHZ-DEFERRED] nurse audit log view, route not in the v1 contract (settings editing is out of v1 scope, PRD section 7)', async () => {});
    it.skip('[AUTHZ-DEFERRED] intern audit log view, route not in the v1 contract (settings editing is out of v1 scope, PRD section 7)', async () => {});
    it.skip('[AUTHZ-DEFERRED] nephrologist audit log view, route not in the v1 contract (settings editing is out of v1 scope, PRD section 7)', async () => {});
    it.skip('[AUTHZ-DEFERRED] admin audit log view, route not in the v1 contract (settings editing is out of v1 scope, PRD section 7)', async () => {});
  });
});
