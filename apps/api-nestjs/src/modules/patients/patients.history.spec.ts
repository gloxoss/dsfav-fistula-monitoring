import { CLINICAL_DISCLAIMER } from '../../common/constants.js';
import { serializeHistory } from './history.serializer.js';

describe('patient measurement history', () => {
  it('[UC8] returns newest-first contract DTOs and an empty list for no sessions', async () => {
    const rows = [
      {
        id: 'new', recordedAt: new Date('2026-02-02T00:00:00Z'), captureDurationSec: 25,
        cleanDurationSec: 24, avgPressureKpa: 5.4, artifactRatioPct: 4, status: 'NORMAL',
        rejectReason: 'NONE', rmsValue: 0.15, peakAmplitude: 0.62, dominantFreqHz: 68,
        highLowEnergyRatio: 0.32, baselineDeviationScore: 1.2, spectrogramJson: [[1, 2]],
      },
      {
        id: 'old', recordedAt: new Date('2026-02-01T00:00:00Z'), captureDurationSec: 25,
        cleanDurationSec: 23, avgPressureKpa: 5.3, artifactRatioPct: 5, status: 'TO_CONFIRM',
        rejectReason: 'NONE', rmsValue: 0.17, peakAmplitude: 0.7, dominantFreqHz: 66,
        highLowEnergyRatio: 0.4, baselineDeviationScore: 3.8, spectrogramJson: null,
      },
    ];
    const history = serializeHistory(rows);
    expect(history.map((measurement) => measurement.measurementId)).toEqual(['new', 'old']);
    expect(history[0].recordedAt).toEqual('2026-02-02T00:00:00.000Z');
    expect(history[1].recordedAt).toEqual('2026-02-01T00:00:00.000Z');
    expect(history[0]).toEqual(expect.objectContaining({
      measurementId: 'new',
      status: 'NORMAL',
      rejectReason: 'NONE',
      quality_gate: {
        passed: true,
        clean_duration_sec: 24,
        artifact_ratio_pct: 4,
        avg_pressure_kpa: 5.4,
        reject_reason: 'NONE',
        message: expect.any(String),
      },
      features: { rms: 0.15, peak_to_peak: 0.62, dominant_freq_hz: 68, stenosis_ratio: 0.32 },
      baseline_comparison: expect.objectContaining({
        deviation_score: 1.2,
        status: 'NORMAL',
        clinical_explanation: 'Écart calculé : 1,20.',
      }),
      disclaimer: CLINICAL_DISCLAIMER,
    }));

    expect(serializeHistory([])).toEqual([]);
  });
});
