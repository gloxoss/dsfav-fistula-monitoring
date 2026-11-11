import { AlertStatus, MeasurementState, RejectReason } from '@prisma/client';
import { CLINICAL_DISCLAIMER } from '../../common/constants.js';
import { serializeMeasurementResult } from './measurement.serializer.js';

describe('measurement result contract', () => {
  it('[UC3] INIT serialization carries state without a clinical status or quality pass', () => {
    const result = serializeMeasurementResult({
      id: 'measurement-init',
      state: MeasurementState.INIT,
      status: null,
      rejectReason: RejectReason.NONE,
      cleanDurationSec: 0,
      artifactRatioPct: 0,
      avgPressureKpa: 0,
      rmsValue: null,
      peakAmplitude: null,
      dominantFreqHz: null,
      highLowEnergyRatio: null,
      baselineDeviationScore: null,
    });
    expect(result).toMatchObject({
      state: MeasurementState.INIT,
      status: null,
      quality_gate: { passed: false },
    });
  });

  it('[DISCLAIMER] includes the exact disclaimer in all measurement result locations', () => {
    const result = serializeMeasurementResult({
      id: 'measurement-id',
      state: MeasurementState.ANALYSED,
      status: AlertStatus.BASELINE_BUILDING,
      rejectReason: RejectReason.NONE,
      cleanDurationSec: 24,
      artifactRatioPct: 4,
      avgPressureKpa: 5.4,
      rmsValue: 0.145,
      peakAmplitude: 0.62,
      dominantFreqHz: 68,
      highLowEnergyRatio: 0.32,
      baselineDeviationScore: null,
      spectrogramJson: [[1, 2]],
    });
    expect(result.disclaimer).toBe(CLINICAL_DISCLAIMER);
    expect(result.baseline_comparison.disclaimer).toBe(CLINICAL_DISCLAIMER);
    expect(result).toMatchObject({
      measurementId: 'measurement-id',
      quality_gate: { passed: true, clean_duration_sec: 24 },
      features: { rms: 0.145, stenosis_ratio: 0.32 },
      stft_preview: [[1, 2]],
    });
  });

  it('[UC7] returns optional AI opinion unchanged when present', () => {
    const aiOpinion = { level: '50', evidence: { features: [{ name: 'rms', value: 0.14 }], baselineValues: [], topContributors: ['rms'] }, modelVersion: 'v1', dataLabel: 'Données synthétiques, non cliniques' };
    const result = serializeMeasurementResult({
      id: 'measurement-ai', state: MeasurementState.ANALYSED, status: AlertStatus.NORMAL,
      rejectReason: RejectReason.NONE, cleanDurationSec: 24, artifactRatioPct: 0,
      avgPressureKpa: 5, rmsValue: 0.14, peakAmplitude: 0.2, dominantFreqHz: 45,
      highLowEnergyRatio: 0.4, baselineDeviationScore: 0, aiOpinion,
    });
    expect((result as { aiOpinion?: unknown }).aiOpinion).toEqual(aiOpinion);
  });
});
