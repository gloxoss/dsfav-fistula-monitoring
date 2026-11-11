import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MeasurementSource, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { WebSocket, RawData } from 'ws';
import { PrismaService } from '../common/prisma.service.js';
import { ConfigService } from '../modules/config/config.service.js';
import {
  CANONICAL_BATTERY_BLOCK_PCT,
  CANONICAL_BATTERY_WARN_PCT,
  CANONICAL_CAPTURE_CONFIG,
  CaptureConfig,
  evaluateStart,
  pressureInValidWindow,
  pressureZone,
  qualityVerdict,
} from './capture-gate.js';

const TELEMETRY_HZ = 10;
const CAPTURE_ROLES = new Set(['NURSE', 'INTERN']);

interface SessionUser {
  sub: string;
  role: string;
}

interface DeviceSession {
  socket: WebSocket;
  deviceId: string;
  serialNumber: string;
  batteryPct: number;
  pressureKpa: number | null;
  validSamples: number;
  hasTelemetry: boolean;
  config: CaptureConfig;
  run: CaptureRun | null;
}

interface CaptureRun {
  measurementId: string;
  device: DeviceSession;
  captureSockets: Set<WebSocket>;
  telemetryCount: number;
  artifactEpochs: Set<number>;
  pressureInvalidEpochs: Set<number>;
}

interface CaptureSubscription {
  measurementId: string;
  deviceId: string;
  user: SessionUser;
  attempts: number;
}

interface CaptureSocketEntry {
  subscription: CaptureSubscription | null;
  pending: string[];
}

type WsPayload = RawData | string;

function frameText(data: WsPayload): string | null {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data)).toString('utf8');
  return null;
}

function parseFrame(data: WsPayload): Record<string, unknown> | null {
  const text = frameText(data);
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function numberField(frame: Record<string, unknown>, key: string): number | null {
  const value = frame[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringField(frame: Record<string, unknown>, key: string): string | null {
  const value = frame[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pathId(url: string | undefined, segment: string): string | null {
  if (!url) return null;
  const parts = new URL(url, 'ws://localhost').pathname.split('/').filter(Boolean);
  const index = parts.indexOf(segment);
  if (index < 0 || parts.length <= index + 1) return null;
  return decodeURIComponent(parts[index + 1]);
}

export function captureConfigFromValues(values: Prisma.JsonValue): CaptureConfig {
  const input = values && !Array.isArray(values) && typeof values === 'object' ? (values as Record<string, unknown>) : {};
  const number = (key: string, fallback: number): number => {
    const value = input[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  };
  return {
    pressureMinKpa: number('pressureMinKpa', CANONICAL_CAPTURE_CONFIG.pressureMinKpa),
    pressureLowKpa: number('pressureLowKpa', CANONICAL_CAPTURE_CONFIG.pressureLowKpa),
    pressureHighKpa: number('pressureHighKpa', CANONICAL_CAPTURE_CONFIG.pressureHighKpa),
    pressureMaxKpa: number('pressureMaxKpa', CANONICAL_CAPTURE_CONFIG.pressureMaxKpa),
    motionThresholdG: number('motionThresholdG', CANONICAL_CAPTURE_CONFIG.motionThresholdG),
    cleanTimeMinSec: number('cleanTimeMinSec', CANONICAL_CAPTURE_CONFIG.cleanTimeMinSec),
    batteryWarnPct: number('batteryWarnPct', CANONICAL_BATTERY_WARN_PCT),
    batteryBlockPct: number('batteryBlockPct', CANONICAL_BATTERY_BLOCK_PCT),
  };
}

// In-memory relay: one API instance for v1 (ponytail). The upgrade path is
// Redis pub/sub if the API scales out, which is why the map stays private.
@Injectable()
export class RealtimeRelayService {
  private readonly logger = new Logger(RealtimeRelayService.name);
  private readonly deviceSockets = new Map<WebSocket, { pending: string[]; session: DeviceSession | null; closed: boolean }>();
  private readonly devicesByDeviceId = new Map<string, DeviceSession>();
  private readonly captureSockets = new Map<WebSocket, CaptureSocketEntry>();
  private readonly runsByMeasurement = new Map<string, CaptureRun>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  attachDeviceSocket(socket: WebSocket, requestUrl: string | undefined): void {
    const urlDeviceKey = pathId(requestUrl, 'device');
    const entry = { pending: [] as string[], session: null as DeviceSession | null, closed: false };
    this.deviceSockets.set(socket, entry);
    socket.on('close', () => this.dropDeviceSocket(socket));
    socket.on('message', (data: RawData) => {
      const text = frameText(data);
      if (!text) return;
      const frame = parseFrame(text);
      if (!frame) return;
      if (!entry.session) {
        if (stringField(frame, 'type') === 'hello') {
          void this.handleDeviceHello(socket, frame, urlDeviceKey).catch((error: unknown) => {
            this.logger.error(`device hello failed: ${String(error)}`);
            this.sendError(socket, 'HELLO_FAILED', "Appairage de l'appareil impossible", true);
            socket.close(1011, 'hello failed');
          });
        } else {
          entry.pending.push(text);
        }
        return;
      }
      this.onDeviceFrame(entry.session, frame, text);
    });
    if (!urlDeviceKey) {
      this.sendError(socket, 'DEVICE_UNKNOWN', 'Identifiant appareil manquant', false);
      socket.close(1008, 'device unknown');
    }
  }

  private async handleDeviceHello(socket: WebSocket, frame: Record<string, unknown>, urlDeviceKey: string | null): Promise<void> {
    const entry = this.deviceSockets.get(socket);
    if (!entry || entry.session) return;
    const declared = stringField(frame, 'serialNumber') ?? stringField(frame, 'deviceId');
    const key = urlDeviceKey ?? declared;
    const token = stringField(frame, 'token') ?? '';
    if (!key) {
      this.sendError(socket, 'DEVICE_UNKNOWN', 'Identifiant appareil manquant', false);
      socket.close(1008, 'device unknown');
      return;
    }
    const device = await this.prisma.device.findFirst({
      where: { OR: [{ serialNumber: key }, { id: key }] },
    });
    if (!device?.deviceTokenHash || hashToken(token) !== device.deviceTokenHash) {
      this.sendError(socket, 'UNAUTHORIZED', "Jeton d'appareil invalide", false);
      socket.close(1008, 'device token');
      return;
    }
    let config: CaptureConfig;
    try {
      const active = await this.configService.getActive();
      config = captureConfigFromValues(active.values);
    } catch {
      this.sendError(socket, 'CONFIG_UNAVAILABLE', 'Aucune configuration clinique active', true);
      socket.close(1011, 'config unavailable');
      return;
    }
    const previous = this.devicesByDeviceId.get(device.id);
    if (previous && previous.socket !== socket) previous.socket.close(1000, 'device reconnected');
    const session: DeviceSession = {
      socket,
      deviceId: device.id,
      serialNumber: device.serialNumber,
      batteryPct: Math.max(0, Math.round(numberField(frame, 'battery') ?? device.lastBatteryPct)),
      pressureKpa: null,
      validSamples: 0,
      hasTelemetry: false,
      config,
      run: null,
    };
    entry.session = session;
    this.devicesByDeviceId.set(device.id, session);
    this.send(socket, {
      type: 'helloAck',
      status: 'READY',
      serverTime: new Date().toISOString(),
      config: {
        pressureMinKpa: config.pressureMinKpa,
        pressureLowKpa: config.pressureLowKpa,
        pressureHighKpa: config.pressureHighKpa,
        pressureMaxKpa: config.pressureMaxKpa,
        motionThresholdG: config.motionThresholdG,
      },
    });
    const pending = entry.pending.splice(0);
    for (const text of pending) {
      const parsed = parseFrame(text);
      if (parsed) this.onDeviceFrame(session, parsed, text);
    }
  }

  attachCaptureSocket(socket: WebSocket, requestUrl: string | undefined): void {
    const entry: CaptureSocketEntry = { subscription: null, pending: [] };
    this.captureSockets.set(socket, entry);
    socket.on('close', () => this.dropCaptureSocket(socket));
    socket.on('message', (data: RawData) => {
      const text = frameText(data);
      if (!text) return;
      if (!entry.subscription) {
        entry.pending.push(text);
        return;
      }
      void this.onCaptureFrame(socket, text).catch((error: unknown) => this.logger.error(`capture frame failed: ${String(error)}`));
    });
    void this.authenticateCapture(socket, requestUrl, entry).catch((error: unknown) => {
      this.logger.error(`capture authentication failed: ${String(error)}`);
      this.sendError(socket, 'UNAUTHORIZED', 'Session requise pour la capture', false);
      socket.close(1011, 'capture auth failed');
    });
  }

  private async authenticateCapture(socket: WebSocket, requestUrl: string | undefined, entry: CaptureSocketEntry): Promise<void> {
    const measurementId = pathId(requestUrl, 'capture');
    const token = requestUrl ? new URL(requestUrl, 'ws://localhost').searchParams.get('token') ?? '' : '';
    let payload: { sub?: string; role?: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub?: string; role?: string }>(token);
    } catch {
      this.sendError(socket, 'UNAUTHORIZED', 'Session requise pour la capture', false);
      socket.close(1008, 'capture token');
      return;
    }
    if (!measurementId || !payload.sub || !payload.role || !CAPTURE_ROLES.has(payload.role)) {
      this.sendError(socket, 'ROLE_FORBIDDEN', 'Rôle non autorisé pour la capture', false);
      socket.close(1008, 'capture role');
      return;
    }
    const measurement = await this.prisma.measurement.findUnique({
      where: { id: measurementId },
      select: { deviceId: true, operatorId: true, source: true },
    });
    if (!measurement) {
      this.sendError(socket, 'MEASUREMENT_UNKNOWN', 'SÃ©ance inconnue', false);
      socket.close(1008, 'measurement unknown');
      return;
    }
    if (
      measurement.operatorId !== payload.sub ||
      (measurement.source === MeasurementSource.BENCH && payload.role !== 'INTERN') ||
      (measurement.source === MeasurementSource.PATIENT && payload.role !== 'NURSE')
    ) {
      this.sendError(socket, 'ROLE_FORBIDDEN', 'AccÃ¨s refusÃ© Ã  cette sÃ©ance', false);
      socket.close(1008, 'measurement access');
      return;
    }
    entry.subscription = {
      measurementId,
      deviceId: measurement.deviceId,
      user: { sub: payload.sub, role: payload.role },
      attempts: 0,
    };
    for (const text of entry.pending.splice(0)) {
      await this.onCaptureFrame(socket, text);
    }
  }

  private onDeviceFrame(session: DeviceSession, frame: Record<string, unknown>, text: string): void {
    const type = stringField(frame, 'type');
    if (type === 'telemetry') this.onTelemetry(session, frame, text);
    else if (type === 'preview') this.onPreview(session, text);
    else if (type === 'captureDone') this.onCaptureDone(session);
  }

  private onTelemetry(session: DeviceSession, frame: Record<string, unknown>, text: string): void {
    const kpa = numberField(frame, 'pressureKpa');
    const battery = numberField(frame, 'battery');
    const motionG = numberField(frame, 'motionG') ?? 0;
    if (battery !== null) session.batteryPct = Math.max(0, Math.round(battery));
    session.pressureKpa = kpa;
    session.hasTelemetry = true;
    if (kpa !== null && pressureInValidWindow(kpa, session.config)) session.validSamples += 1;
    else session.validSamples = 0;

    const run = session.run;
    if (run) {
      const epoch = Math.floor(run.telemetryCount / TELEMETRY_HZ);
      if (motionG > session.config.motionThresholdG) run.artifactEpochs.add(epoch);
      if (kpa === null || !pressureInValidWindow(kpa, session.config)) run.pressureInvalidEpochs.add(epoch);
      run.telemetryCount += 1;
    }
    const elapsedSec = run ? run.telemetryCount / TELEMETRY_HZ : 0;
    const invalidSeconds = run ? new Set([...run.artifactEpochs, ...run.pressureInvalidEpochs]).size : 0;
    const cleanDurationSec = Math.max(0, elapsedSec - invalidSeconds);
    for (const [socket, captureEntry] of this.captureSockets) {
      const subscription = captureEntry.subscription;
      if (!subscription || subscription.deviceId !== session.deviceId || socket.readyState !== WebSocket.OPEN) continue;
      socket.send(text);
      const isRunForSocket = run?.measurementId === subscription.measurementId;
      this.send(socket, {
        type: 'stateUpdate',
        measurementId: subscription.measurementId,
        elapsedSec: round1(isRunForSocket ? elapsedSec : 0),
        cleanDurationSec: round1(isRunForSocket ? cleanDurationSec : 0),
        pressureKpa: kpa,
        pressureZone: kpa === null ? 'BLOCKED_LOW' : pressureZone(kpa, session.config),
        stableSec: round1(session.validSamples / TELEMETRY_HZ),
        motionArtifact: motionG > session.config.motionThresholdG,
        repositionAttempts: subscription.attempts,
        batteryPct: session.batteryPct,
        artifactEpochs: isRunForSocket && run ? [...run.artifactEpochs].sort((a, b) => a - b) : [],
      });
    }
  }

  private onPreview(session: DeviceSession, text: string): void {
    for (const [socket, entry] of this.captureSockets) {
      if (entry.subscription?.deviceId === session.deviceId && socket.readyState === WebSocket.OPEN) {
        socket.send(text);
      }
    }
  }

  private onCaptureDone(session: DeviceSession): void {
    const run = session.run;
    if (!run) return;
    const verdict = qualityVerdict(
      {
        elapsedSec: run.telemetryCount / TELEMETRY_HZ,
        artifactEpochs: [...run.artifactEpochs],
        pressureInvalidEpochs: [...run.pressureInvalidEpochs],
      },
      session.config,
    );
    this.broadcast(run, { type: 'captureDone', measurementId: run.measurementId });
    this.broadcast(run, {
      type: 'captureVerdict',
      measurementId: run.measurementId,
      status: verdict.status,
      rejectReason: verdict.rejectReason,
      cleanDurationSec: verdict.cleanDurationSec,
      artifactEpochs: verdict.artifactEpochs,
    });
    this.runsByMeasurement.delete(run.measurementId);
    session.run = null;
  }

  private async onCaptureFrame(socket: WebSocket, text: string): Promise<void> {
    const frame = parseFrame(text);
    if (!frame) return;
    const entry = this.captureSockets.get(socket);
    const subscription = entry?.subscription;
    if (!entry || !subscription) return;
    if (stringField(frame, 'type') === 'captureStart') await this.startCapture(socket, subscription, frame);
  }

  private async startCapture(socket: WebSocket, subscription: CaptureSubscription, frame: Record<string, unknown>): Promise<void> {
    const measurementId = stringField(frame, 'measurementId') ?? subscription.measurementId;
    if (measurementId !== subscription.measurementId) {
      this.refuseCapture(socket, subscription, measurementId, 'MEASUREMENT_MISMATCH', 'La séance ne correspond pas au canal de capture', false);
      return;
    }
    if (this.runsByMeasurement.has(measurementId)) {
      this.refuseCapture(socket, subscription, measurementId, 'CAPTURE_ACTIVE', 'Une capture est déjà en cours pour cette séance', true);
      return;
    }
    const measurement = await this.prisma.measurement.findUnique({ where: { id: measurementId } });
    if (!measurement) {
      this.refuseCapture(socket, subscription, measurementId, 'MEASUREMENT_UNKNOWN', 'Séance inconnue', false);
      return;
    }
    if (measurement.operatorId !== subscription.user.sub) {
      this.refuseCapture(socket, subscription, measurementId, 'MEASUREMENT_OWNER', 'Cette séance appartient à un autre opérateur', false);
      return;
    }
    if (measurement.source === MeasurementSource.BENCH && subscription.user.role !== 'INTERN') {
      this.refuseCapture(socket, subscription, measurementId, 'ROLE_FORBIDDEN', 'Le banc est réservé à la formation', false);
      return;
    }
    if (measurement.source === MeasurementSource.PATIENT && subscription.user.role !== 'NURSE') {
      this.refuseCapture(socket, subscription, measurementId, 'ROLE_FORBIDDEN', 'Seul un infirmier peut démarrer une mesure patient', false);
      return;
    }
    const device = this.devicesByDeviceId.get(measurement.deviceId);
    if (!device || device.socket.readyState !== WebSocket.OPEN) {
      this.refuseCapture(socket, subscription, measurementId, 'DEVICE_OFFLINE', "L'appareil n'est pas connecté", true);
      return;
    }
    const config = device.config;
    const decision = evaluateStart(
      {
        zone: device.pressureKpa === null ? 'BLOCKED_LOW' : pressureZone(device.pressureKpa, config),
        stableSec: device.validSamples / TELEMETRY_HZ,
        batteryPct: device.batteryPct,
        telemetrySeen: device.hasTelemetry,
        attempts: subscription.attempts,
      },
      config,
    );
    if (!decision.ok) {
      subscription.attempts += 1;
      this.send(socket, {
        type: 'captureRefused',
        measurementId,
        code: decision.code,
        message_fr: decision.message_fr,
        retryable: decision.retryable,
        repositionAttempts: subscription.attempts,
      });
      return;
    }
    const captureSockets = new Set<WebSocket>([socket]);
    for (const [candidate, candidateEntry] of this.captureSockets) {
      if (candidate !== socket && candidateEntry.subscription?.measurementId === measurementId && candidate.readyState === WebSocket.OPEN) {
        captureSockets.add(candidate);
      }
    }
    const run: CaptureRun = {
      measurementId,
      device,
      captureSockets,
      telemetryCount: 0,
      artifactEpochs: new Set<number>(),
      pressureInvalidEpochs: new Set<number>(),
    };
    device.run = run;
    this.runsByMeasurement.set(measurementId, run);
    this.send(device.socket, { type: 'captureStart', measurementId });
    this.send(socket, {
      type: 'captureStarted',
      measurementId,
      pressureZone: device.pressureKpa === null ? 'BLOCKED_LOW' : pressureZone(device.pressureKpa, config),
      stableSec: round1(device.validSamples / TELEMETRY_HZ),
      batteryPct: device.batteryPct,
    });
    if (decision.warning) {
      this.send(socket, {
        type: 'captureWarning',
        measurementId,
        code: decision.warning.code,
        message_fr: decision.warning.message_fr,
      });
    }
  }

  private refuseCapture(
    socket: WebSocket,
    subscription: CaptureSubscription,
    measurementId: string,
    code: string,
    messageFr: string,
    retryable: boolean,
  ): void {
    subscription.attempts += 1;
    this.send(socket, {
      type: 'captureRefused',
      measurementId,
      code,
      message_fr: messageFr,
      retryable,
      repositionAttempts: subscription.attempts,
    });
  }

  private broadcast(run: CaptureRun, payload: Record<string, unknown> | string): void {
    for (const socket of run.captureSockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
    }
  }

  private send(socket: WebSocket, payload: Record<string, unknown>): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }

  private sendError(socket: WebSocket, code: string, messageFr: string, retryable: boolean): void {
    this.send(socket, { type: 'error', code, message_fr: messageFr, retryable });
  }

  private dropDeviceSocket(socket: WebSocket): void {
    const entry = this.deviceSockets.get(socket);
    this.deviceSockets.delete(socket);
    const session = entry?.session;
    if (!session) return;
    if (session.run) {
      this.broadcast(session.run, { type: 'error', code: 'DEVICE_OFFLINE', message_fr: "L'appareil s'est déconnecté", retryable: true });
      this.runsByMeasurement.delete(session.run.measurementId);
      session.run = null;
    }
    if (this.devicesByDeviceId.get(session.deviceId)?.socket === socket) this.devicesByDeviceId.delete(session.deviceId);
  }

  private dropCaptureSocket(socket: WebSocket): void {
    this.captureSockets.delete(socket);
    for (const run of this.runsByMeasurement.values()) run.captureSockets.delete(socket);
  }

}
