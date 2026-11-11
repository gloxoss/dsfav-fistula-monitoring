import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface CaptureHeader {
  sampleRateAdxl: number;
  sampleRateLis: number;
  adxlSamples: number;
  lisSamples: number;
  pressureSamples: number;
  durationSec: number;
  avgPressureKpa: number;
}

export interface DspResult {
  status: 'NORMAL' | 'TO_CONFIRM' | 'UNUSUAL_EVOLUTION' | 'REJECTED_QUALITY' | 'BASELINE_BUILDING';
  reject_reason: 'ARTIFACT' | 'PRESSURE' | null;
  clean_seconds: number;
  artifact_epochs: number[];
  rms: number;
  p2p: number;
  dominant_hz: number;
  ratio: number;
  deviation: number | null;
  top_feature: string | null;
  top_change_pct: number | null;
  stft: number[][];
  explanation: string;
  disclaimer: string;
  aiOpinion?: {
    level: string;
    evidence: { features: { name: string; value: number }[]; baselineValues: { name: string; value: number }[]; topContributors: string[] };
    modelVersion: string;
    dataLabel: string;
  };
}

const HEADER_SIZE = 18;
const MAGIC = 'DSFV';
const VERSION = 1;
const PRESSURE_FS_HZ = 10;

export function parseCaptureHeader(raw: Buffer): CaptureHeader {
  if (raw.length < HEADER_SIZE) throw new BadRequestException({ code: 'INVALID_HEADER', message_fr: 'En-tête binaire incomplet', retryable: false });
  if (raw.toString('ascii', 0, 4) !== MAGIC) throw new BadRequestException({ code: 'INVALID_HEADER', message_fr: 'Signature binaire invalide', retryable: false });
  if (raw.readUInt16LE(4) !== VERSION) throw new BadRequestException({ code: 'INVALID_HEADER', message_fr: 'Version de protocole non prise en charge', retryable: false });
  const sampleRateAdxl = raw.readUInt16LE(6);
  const sampleRateLis = raw.readUInt16LE(8);
  const adxlSamples = raw.readUInt32LE(10);
  const lisSamples = raw.readUInt32LE(14);
  if (!sampleRateAdxl || !sampleRateLis || !adxlSamples || !lisSamples) {
    throw new BadRequestException({ code: 'INVALID_HEADER', message_fr: 'Fréquences ou échantillons invalides', retryable: false });
  }
  const pressureSamples = Math.floor((adxlSamples * PRESSURE_FS_HZ) / sampleRateAdxl);
  const expectedLength = HEADER_SIZE + adxlSamples * 6 + lisSamples * 6 + pressureSamples * 2;
  if (raw.length !== expectedLength) throw new BadRequestException({ code: 'INVALID_PAYLOAD', message_fr: 'Taille du flux binaire invalide', retryable: false });
  const pressureOffset = HEADER_SIZE + (adxlSamples + lisSamples) * 6;
  let pressureSum = 0;
  for (let index = 0; index < pressureSamples; index += 1) {
    pressureSum += raw.readInt16LE(pressureOffset + index * 2) / 100;
  }
  return {
    sampleRateAdxl,
    sampleRateLis,
    adxlSamples,
    lisSamples,
    pressureSamples,
    durationSec: adxlSamples / sampleRateAdxl,
    avgPressureKpa: pressureSamples ? pressureSum / pressureSamples : 0,
  };
}

@Injectable()
export class DspClient {
  async process(raw: Buffer, header: CaptureHeader, config: Record<string, number>, baseline: Record<string, number> | null, gain: number, baselineLocked = baseline !== null): Promise<DspResult> {
    const baseUrl = process.env.DSP_URL;
    if (!baseUrl) throw this.unavailable();
    const dspConfig = {
      threshold: config.thresholdSigma,
      min_clean_s: config.cleanTimeMinSec,
      motion_g: config.motionThresholdG,
      pressure_min_kpa: config.pressureMinKpa,
      pressure_max_kpa: config.pressureMaxKpa,
      std_floor_pct: (config.stdFloorPct ?? 5) / 100,
    };
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/internal/v1/process-thrill`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          header: { gain: 1 / gain },
          baseline,
          ai_enabled: baselineLocked,
          config: dspConfig,
          raw_b64: raw.toString('base64'),
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        if (response.status >= 500) throw this.unavailable();
        throw new BadRequestException({ code: 'DSP_REJECTED', message_fr: 'Le signal n’a pas pu être analysé', retryable: false });
      }
      return await response.json() as DspResult;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      throw this.unavailable();
    }
  }

  private unavailable() {
    return new ServiceUnavailableException({
      code: 'DSP_UNAVAILABLE',
      message_fr: 'Analyse temporairement indisponible, réessayez sans supprimer la séance',
      retryable: true,
    });
  }
}
