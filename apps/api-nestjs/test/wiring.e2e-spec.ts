import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import WebSocket from 'ws';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/http-exception.filter.js';
import { PrismaService } from '../src/common/prisma.service.js';
import { DsfavWsAdapter } from '../src/realtime/dsfav-ws.adapter.js';

const WS_TIMEOUT_MS = 8000;

type AppWithBodyParser = INestApplication & {
  useBodyParser(type: 'json', options: { limit: string }): void;
};

describe('Application wiring [UC1]', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  let wsBaseUrl: string;
  let nurseToken: string;
  let measurementId: string;
  let captureSocket: WebSocket | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule, DiscoveryModule] }).compile();
    app = moduleFixture.createNestApplication();
    (app as AppWithBodyParser).useBodyParser('json', { limit: '16mb' });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useWebSocketAdapter(new DsfavWsAdapter(app));
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    wsBaseUrl = `ws://127.0.0.1:${address.port}`;
    prisma = app.get(PrismaService);

    const login = await request(baseUrl)
      .post('/auth/login')
      .send({ email: 'nurse@dsfav.local', password: 'demo1234' })
      .expect(200);
    nurseToken = login.body.token as string;
  }, 30000);

  afterAll(async () => {
    captureSocket?.close();
    if (measurementId && prisma) {
      await prisma.measurement.deleteMany({ where: { id: measurementId } });
    }
    await app?.close();
  }, 30000);

  it('[UC1] boots real modules, serves health, sync body, and capture WebSocket', async () => {
    await request(baseUrl).get('/health').expect(200).expect(({ body }) => {
      expect(body).toMatchObject({ status: 'ok', service: 'api' });
    });

    const controllerNames = app.get(DiscoveryService, { strict: false }).getControllers()
      .map(({ metatype }) => metatype?.name ?? '');
    expect(controllerNames.some((name) => name.includes('Placeholder'))).toBe(false);
    const appModuleSource = await readFile(fileURLToPath(new URL('../src/app.module.ts', import.meta.url)), 'utf8');
    expect(appModuleSource).not.toMatch(/@Controller\s*\(/);

    await request(baseUrl)
      .post('/devices/sync')
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ deviceSerial: 'DSFAV-UNIT-01', items: [], padding: 'x'.repeat(300 * 1024) })
      .expect((response) => expect(response.status).not.toBe(413));

    const measurement = await request(baseUrl)
      .post('/measurements')
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ deviceId: 'dev-01-001', idPseudo: 'PT-CAS-8841', source: 'PATIENT' })
      .expect(201);
    measurementId = measurement.body.measurementId as string;

    const firstFrame = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for capture WebSocket frame')), WS_TIMEOUT_MS);
      captureSocket = new WebSocket(`${wsBaseUrl}/ws/capture/${measurementId}?token=${encodeURIComponent(nurseToken)}`);
      captureSocket.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      captureSocket.once('open', () => {
        captureSocket?.send(JSON.stringify({ type: 'captureStart', measurementId }));
      });
      captureSocket.once('message', (data) => {
        clearTimeout(timer);
        const frame = Array.isArray(data)
          ? Buffer.concat(data).toString('utf8')
          : Buffer.isBuffer(data)
            ? data.toString('utf8')
            : Buffer.from(data as ArrayBuffer).toString('utf8');
        resolve(JSON.parse(frame) as Record<string, unknown>);
      });
    });
    expect(firstFrame.type).toBeDefined();
  }, 30000);
});
