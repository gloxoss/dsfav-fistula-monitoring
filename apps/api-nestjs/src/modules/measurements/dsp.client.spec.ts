import { DspClient, parseCaptureHeader } from './dsp.client.js';

function capturePayload(): Buffer {
  const adxlSamples = 1000;
  const lisSamples = 200;
  const pressureSamples = 10;
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

describe('DSP request contract', () => {
  it('[UC6] [UC12] validates the binary header and sends inverse device gain to the DSP', async () => {
    const raw = capturePayload();
    const header = parseCaptureHeader(raw);
    expect(header).toMatchObject({
      sampleRateAdxl: 1000,
      sampleRateLis: 200,
      durationSec: 1,
    });
    expect(header.avgPressureKpa).toBeCloseTo(5.4);

    const dspResult = {
      status: 'NORMAL', reject_reason: null, clean_seconds: 1, artifact_epochs: [],
      rms: 0.145, p2p: 0.62, dominant_hz: 68, ratio: 0.32, deviation: 1.1,
      top_feature: 'rms', top_change_pct: 2.1, stft: [[0.2]], explanation: 'ok', disclaimer: 'ignored',
    };
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      calls.push({ url, init });
      return { ok: true, json: async () => dspResult } as Response;
    }) as typeof fetch;
    const previousUrl = process.env.DSP_URL;
    process.env.DSP_URL = 'http://dsp.test';
    try {
      await expect(new DspClient().process(raw, header, {
        thresholdSigma: 3.4,
        consecutiveAlerts: 2,
        pressureMinKpa: 2.5,
        pressureMaxKpa: 9,
        motionThresholdG: 0.08,
        cleanTimeMinSec: 12,
        stdFloorPct: 5,
      }, null, 1.039)).resolves.toEqual(dspResult);
      expect(calls).toHaveLength(1);
      const body = calls[0].init?.body;
      expect(typeof body).toBe('string');
      const request = JSON.parse(body as string) as Record<string, unknown>;
      expect(calls[0].url).toBe('http://dsp.test/internal/v1/process-thrill');
      expect(request).toMatchObject({ baseline: null, raw_b64: raw.toString('base64') });
      expect((request.header as { gain: number }).gain).toBeCloseTo(0.9625, 4);
      expect(request.config).toEqual({
        threshold: 3.4,
        min_clean_s: 12,
        motion_g: 0.08,
        pressure_min_kpa: 2.5,
        pressure_max_kpa: 9,
        std_floor_pct: 0.05,
      });
    } finally {
      globalThis.fetch = originalFetch;
      if (previousUrl === undefined) delete process.env.DSP_URL;
      else process.env.DSP_URL = previousUrl;
    }
  });
});
