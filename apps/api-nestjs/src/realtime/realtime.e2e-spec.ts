import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import WebSocket from 'ws';
import { PrismaService } from '../common/prisma.service.js';
import { HttpExceptionFilter } from '../common/http-exception.filter.js';
import { AuthModule } from '../modules/auth/auth.module.js';
import { MeasurementsModule } from '../modules/measurements/measurements.module.js';
import { PrismaModule } from '../common/prisma.module.js';
import { DsfavWsAdapter } from './dsfav-ws.adapter.js';
import { RealtimeModule } from './realtime.module.js';

const DEVICE_SERIAL = 'DSFAV-UNIT-01';
const DEVICE_TOKEN = 'dev-token-unit-01';
const PATIENT_PSEUDO = 'PT-CAS-8841';
const WS_TIMEOUT_MS = 8000;

interface Waiter {
  predicate: (message: Record<string, unknown>) => boolean;
  resolve: (message: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

class WsClient {
  private readonly queue: Record<string, unknown>[] = [];
  private readonly waiters: Waiter[] = [];
  private closed = false;

  private constructor(private readonly socket: WebSocket) {
    socket.on('message', (data) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      const waiter = this.waiters.find((candidate) => candidate.predicate(message));
      if (waiter) {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        clearTimeout(waiter.timer);
        waiter.resolve(message);
        return;
      }
      this.queue.push(message);
    });
    socket.on('close', () => {
      this.closed = true;
      for (const waiter of this.waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error('socket closed before the expected frame'));
      }
    });
  }

  static connect(url: string): Promise<WsClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const timer = setTimeout(() => reject(new Error(`timeout connecting to ${url}`)), WS_TIMEOUT_MS);
      socket.once('open', () => {
        clearTimeout(timer);
        resolve(new WsClient(socket));
      });
      socket.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  send(message: Record<string, unknown>): void {
    this.socket.send(JSON.stringify(message));
  }

  next(predicate: (message: Record<string, unknown>) => boolean, timeoutMs = WS_TIMEOUT_MS): Promise<Record<string, unknown>> {
    const index = this.queue.findIndex(predicate);
    if (index >= 0) return Promise.resolve(this.queue.splice(index, 1)[0]);
    if (this.closed) return Promise.reject(new Error('socket already closed'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const position = this.waiters.findIndex((candidate) => candidate.timer === timer);
        if (position >= 0) this.waiters.splice(position, 1);
        reject(new Error('timeout waiting for a WebSocket frame'));
      }, timeoutMs);
      this.waiters.push({ predicate, resolve, reject, timer });
    });
  }

  nextOfType(type: string, timeoutMs = WS_TIMEOUT_MS): Promise<Record<string, unknown>> {
    return this.next((message) => message.type === type, timeoutMs);
  }

  close(): void {
    if (!this.closed) this.socket.close();
  }
}

describe('Capture relay (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let nurseToken: string;
  let baseUrl: string;
  let wsBaseUrl: string;
  const createdMeasurementIds: string[] = [];
  const openSockets: WsClient[] = [];

  async function connectDevice(battery: number): Promise<WsClient> {
    const device = await WsClient.connect(`${wsBaseUrl}/ws/device/${DEVICE_SERIAL}`);
    openSockets.push(device);
    device.send({
      type: 'hello',
      deviceId: DEVICE_SERIAL,
      serialNumber: DEVICE_SERIAL,
      fw: '1.0.4',
      battery,
      token: DEVICE_TOKEN,
    });
    const ack = await device.nextOfType('helloAck');
    expect(ack.status).toBe('READY');
    return device;
  }

  async function connectCapture(measurementId: string): Promise<WsClient> {
    const capture = await WsClient.connect(`${wsBaseUrl}/ws/capture/${measurementId}?token=${encodeURIComponent(nurseToken)}`);
    openSockets.push(capture);
    return capture;
  }

  async function createMeasurement(): Promise<string> {
    const response = await request(baseUrl)
      .post('/measurements')
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ idPseudo: PATIENT_PSEUDO, deviceId: 'dev-01-001', source: 'PATIENT' })
      .expect(201);
    const measurementId = response.body.measurementId as string;
    createdMeasurementIds.push(measurementId);
    return measurementId;
  }

  function telemetry(second: number, tenth: number, options: { pressureKpa?: number; battery?: number; motionG?: number } = {}) {
    return {
      type: 'telemetry',
      pressureKpa: options.pressureKpa ?? 5.4,
      battery: options.battery ?? 95,
      motionG: options.motionG ?? 0.02,
      timestamp: 1794060000000 + second * 1000 + tenth * 100,
    };
  }

  async function streamSecond(
    device: WsClient,
    second: number,
    options: { pressureKpa?: number; battery?: number; motionG?: number } = {},
  ): Promise<void> {
    for (let tenth = 0; tenth < 10; tenth += 1) {
      device.send(telemetry(second, tenth, options));
      await Promise.resolve();
    }
  }

  function isMotionEpoch(epoch: number): boolean {
    return epoch >= 10 && epoch < 12;
  }

  async function startCapture(
    device: WsClient,
    capture: WsClient,
    measurementId: string,
    options: { pressureKpa?: number; battery?: number } = {},
  ): Promise<Record<string, unknown>> {
    await streamSecond(device, 0, { ...options, motionG: 0.02 });
    capture.send({ type: 'captureStart', measurementId });
    return capture.nextOfType('captureStarted');
  }

  function rawCapturePayload(seconds = 25): Buffer {
    const adxlSamples = 1000 * seconds;
    const lisSamples = 200 * seconds;
    const pressureSamples = 10 * seconds;
    const raw = Buffer.alloc(18 + (adxlSamples + lisSamples) * 6 + pressureSamples * 2);
    raw.write('DSFV', 0, 'ascii');
    raw.writeUInt16LE(1, 4);
    raw.writeUInt16LE(1000, 6);
    raw.writeUInt16LE(200, 8);
    raw.writeUInt32LE(adxlSamples, 10);
    raw.writeUInt32LE(lisSamples, 14);
    const pressureOffset = 18 + (adxlSamples + lisSamples) * 6;
    for (let index = 0; index < pressureSamples; index += 1) raw.writeInt16LE(540, pressureOffset + index * 2);
    return raw;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, AuthModule, RealtimeModule, MeasurementsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useWebSocketAdapter(new DsfavWsAdapter(app));
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    wsBaseUrl = `ws://127.0.0.1:${address.port}`;
    prisma = app.get(PrismaService);
    nurseToken = app.get(JwtService).sign({ sub: 'u-nurse-001', role: 'NURSE' });
  });

  afterAll(async () => {
    for (const socket of openSockets) socket.close();
    if (createdMeasurementIds.length > 0) {
      await prisma.measurement.deleteMany({ where: { id: { in: createdMeasurementIds } } });
    }
    await app.close();
  });

  it('[UC1] relays the simulator frames and keeps the stored measurement reachable through the API', async () => {
    const measurementId = await createMeasurement();
    const device = await connectDevice(95);
    const capture = await connectCapture(measurementId);

    await streamSecond(device, 0);
    device.send({ type: 'preview', adxl: [1, 2, 3], lis: [1, 2, 3], timestamp: 1794060000000 });

    capture.send({ type: 'captureStart', measurementId });
    const started = await capture.nextOfType('captureStarted');
    expect(started.measurementId).toBe(measurementId);
    const deviceStart = await device.nextOfType('captureStart');
    // Frames sent before captureStart may be dropped by a slow socket; resend so the relay assertions never depend on timing.
    await streamSecond(device, 0);
    device.send({ type: 'preview', adxl: [1, 2, 3], lis: [1, 2, 3], timestamp: 1794060000001 });
    expect(deviceStart.measurementId).toBe(measurementId);

    const relayedTelemetry = await capture.nextOfType('telemetry');
    expect(relayedTelemetry.type).toBe('telemetry');
    const relayedPreview = await capture.nextOfType('preview');
    expect(relayedPreview.type).toBe('preview');
    const state = await capture.nextOfType('stateUpdate');
    expect(state.pressureZone).toBe('GREEN');
    expect(state.measurementId).toBe(measurementId);

    for (let second = 0; second < 25; second += 1) await streamSecond(device, second + 1);
    device.send({ type: 'captureDone', measurementId });
    const verdict = await capture.nextOfType('captureVerdict');
    expect(verdict.status).toBe('ACCEPTED');

    const upload = await request(baseUrl)
      .put(`/measurements/${measurementId}/raw`)
      .set('Authorization', `Bearer ${nurseToken}`)
      .set('Content-Type', 'application/octet-stream')
      .send(rawCapturePayload());
    expect([200, 503]).toContain(upload.status);

    const detail = await request(baseUrl)
      .get(`/measurements/${measurementId}`)
      .set('Authorization', `Bearer ${nurseToken}`)
      .expect(200);
    expect(detail.body.measurementId).toBe(measurementId);
    expect(detail.body.durationSec).toBe(25);
  }, 30000);

  it('[UC2] refuses a start under 2.5 kPa and above 9.0 kPa with distinct messages', async () => {
    const measurementId = await createMeasurement();
    const device = await connectDevice(95);
    const capture = await connectCapture(measurementId);

    await streamSecond(device, 0, { pressureKpa: 1.8 });
    capture.send({ type: 'captureStart', measurementId });
    const low = await capture.nextOfType('captureRefused');
    expect(low.code).toBe('PRESSURE_LOW');
    expect(String(low.message_fr)).toContain('insuffisant');

    await streamSecond(device, 1, { pressureKpa: 10.2 });
    capture.send({ type: 'captureStart', measurementId });
    const high = await capture.nextOfType('captureRefused');
    expect(high.code).toBe('PRESSURE_HIGH');
    expect(String(high.message_fr)).toContain('compression');
    expect(String(high.message_fr)).not.toContain('insuffisant');
  });

  it('[UC4] keeps a short motion burst (masked epochs) and rejects a heavy one as ARTIFACT', async () => {
    const shortId = await createMeasurement();
    const device = await connectDevice(95);
    const shortCapture = await connectCapture(shortId);

    await startCapture(device, shortCapture, shortId);
    for (let second = 1; second <= 25; second += 1) {
      await streamSecond(device, second, { motionG: isMotionEpoch(second - 1) ? 0.42 : 0.02 });
    }
    device.send({ type: 'captureDone', measurementId: shortId });
    const shortVerdict = await shortCapture.nextOfType('captureVerdict');
    expect(shortVerdict.status).toBe('ACCEPTED');
    expect(shortVerdict.artifactEpochs).toEqual([10, 11]);
    expect(shortVerdict.cleanDurationSec).toBe(23);

    const heavyId = await createMeasurement();
    const heavyCapture = await connectCapture(heavyId);
    await startCapture(device, heavyCapture, heavyId);
    for (let second = 1; second <= 25; second += 1) {
      const epoch = second - 1;
      await streamSecond(device, second, { motionG: epoch >= 5 && epoch < 20 ? 0.42 : 0.02 });
    }
    device.send({ type: 'captureDone', measurementId: heavyId });
    const heavyVerdict = await heavyCapture.nextOfType('captureVerdict');
    expect(heavyVerdict.status).toBe('REJECTED_QUALITY');
    expect(heavyVerdict.rejectReason).toBe('ARTIFACT');
  });

  it('[UC13] refuses a 12 % battery and only warns a 17 % battery', async () => {
    const criticalId = await createMeasurement();
    const criticalDevice = await connectDevice(12);
    const criticalCapture = await connectCapture(criticalId);
    await streamSecond(criticalDevice, 0, { battery: 12 });
    criticalCapture.send({ type: 'captureStart', measurementId: criticalId });
    const refused = await criticalCapture.nextOfType('captureRefused');
    expect(refused.code).toBe('BATTERY_CRITICAL');
    expect(refused.message_fr).toBe('Batterie à 12 %');
    criticalDevice.close();

    const lowId = await createMeasurement();
    const lowDevice = await connectDevice(17);
    const lowCapture = await connectCapture(lowId);
    await streamSecond(lowDevice, 0, { battery: 17 });
    lowCapture.send({ type: 'captureStart', measurementId: lowId });
    const warning = await lowCapture.nextOfType('captureWarning');
    expect(warning.code).toBe('BATTERY_LOW');
    expect(warning.message_fr).toBe('Batterie à 17 %');
    const started = await lowCapture.nextOfType('captureStarted');
    expect(started.measurementId).toBe(lowId);
  });

  it('[AUTHZ-MATRIX] closes a capture socket without a valid session token', async () => {
    const measurementId = await createMeasurement();
    const capture = await WsClient.connect(`${wsBaseUrl}/ws/capture/${measurementId}`);
    openSockets.push(capture);
    const error = await capture.nextOfType('error');
    expect(error.code).toBe('UNAUTHORIZED');
  });
});
