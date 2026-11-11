import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/http-exception.filter.js';
import { DsfavWsAdapter } from '../src/realtime/dsfav-ws.adapter.js';

describe('Input Validation, Limits & Error Bodies [G8]', () => {
  let app: INestApplication;
  let nurseToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const expressApp = moduleFixture.createNestApplication<NestExpressApplication>();
    expressApp.useBodyParser('json', { limit: '16mb' });
    expressApp.use((err: any, _req: any, res: any, next: any) => {
      if (err?.status === 413 || err?.type === 'entity.too.large') {
        return res.status(413).json({
          code: 'PAYLOAD_TOO_LARGE',
          message_fr: 'Taille de requête excessive',
          retryable: false,
        });
      }
      if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({
          code: 'INVALID_JSON',
          message_fr: 'Corps de requête JSON malformé',
          retryable: false,
        });
      }
      next(err);
    });
    expressApp.useWebSocketAdapter(new DsfavWsAdapter(expressApp));
    expressApp.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    expressApp.useGlobalFilters(new HttpExceptionFilter());
    await expressApp.init();
    app = expressApp;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nurse@dsfav.local', password: 'demo1234' })
      .expect(200);
    nurseToken = loginRes.body.token;
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  it('[G8] malformed JSON returns contract error body with code INVALID_JSON', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "broken-json,')
      .expect(400);

    expect(res.body).toEqual({
      code: 'INVALID_JSON',
      message_fr: 'Corps de requête JSON malformé',
      retryable: false,
    });
  });

  it('[G8] oversized JSON payload over 16MB returns 413 PAYLOAD_TOO_LARGE', async () => {
    // 17MB payload to exceed the 16MB limit
    const padding = 'x'.repeat(17 * 1024 * 1024);
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send(`{"email": "nurse@dsfav.local", "padding": "${padding}"}`)
      .expect(413);

    expect(res.body).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message_fr: 'Taille de requête excessive',
      retryable: false,
    });
  }, 30000);

  it('[G8] invalid DTO input returns 400 with contract error body including field details', async () => {
    const res = await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({
        idPseudo: '',
        fistulaType: 'NON_EXISTENT_TYPE',
        armSide: 'INVALID_SIDE',
      })
      .expect(400);

    expect(res.body).toMatchObject({
      code: 'INVALID_INPUT',
      message_fr: expect.any(String),
      retryable: false,
      field: expect.any(String),
    });
  });

  it('[G8] empty raw binary upload returns 400 with code EMPTY_UPLOAD', async () => {
    const res = await request(app.getHttpServer())
      .put('/measurements/00000000-0000-0000-0000-000000000000/raw')
      .set('Authorization', `Bearer ${nurseToken}`)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.alloc(0))
      .expect(400);

    expect(res.body).toMatchObject({
      code: 'EMPTY_UPLOAD',
      message_fr: 'Le flux binaire est vide',
      retryable: false,
    });
  });

  it('[G8] corrupt header in binary upload returns 400 with code INVALID_HEADER', async () => {
    // Invalid magic 'CORR' instead of 'DSFV'
    const corruptHeader = Buffer.from('CORR\x01\x00\xe8\x03\xc8\x00\x10\x27\x00\x00\x88\x13\x00\x00', 'binary');
    const res = await request(app.getHttpServer())
      .put('/measurements/00000000-0000-0000-0000-000000000000/raw')
      .set('Authorization', `Bearer ${nurseToken}`)
      .set('Content-Type', 'application/octet-stream')
      .send(corruptHeader)
      .expect(400);

    expect(res.body).toMatchObject({
      code: 'INVALID_HEADER',
      message_fr: expect.any(String),
      retryable: false,
    });
  });

  it('[G8] sync batch exceeding 50 items returns 400 SYNC_BATCH_TOO_LARGE', async () => {
    const res = await request(app.getHttpServer())
      .post('/devices/sync')
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({
        deviceSerial: 'DSFAV-UNIT-01',
        items: Array.from({ length: 51 }, (_, i) => ({
          idempotencyKey: `overflow-item-${i}`,
          patient: 'PT-CAS-8841',
          raw_b64: 'AA==',
        })),
      })
      .expect(400);

    expect(res.body).toEqual({
      code: 'SYNC_BATCH_TOO_LARGE',
      message_fr: 'Trop de sessions dans un envoi (maximum 50).',
      retryable: false,
    });
  });
});
