import { PerceivedThrill } from '@prisma/client';
import { computeConcordance, expectedProfileFor, placeholderIntensityLevel } from './bench.concordance.js';
import { EXPECTED_PROFILE_LABEL } from './bench.constants.js';
import { analyzeBenchCsv } from './bench.import.js';

describe('bench concordance (pedagogical indicator)', () => {
  const exact = {
    perceivedThrill: PerceivedThrill.SYSTOLIC_ROUGH,
    perceivedIntensity: 3,
    internNotes: 'Frémissement perçu en systole',
    expectedProfile: PerceivedThrill.SYSTOLIC_ROUGH,
    measuredIntensityLevel: 3,
  };

  it('exact match on category, intensity and note -> 100 with 60/25/15 weights', () => {
    const result = computeConcordance(exact);
    expect(result.total).toBe(100);
    expect(result.breakdown).toMatchObject({
      sensationScorePct: 60,
      intensityScorePct: 25,
      notesScorePct: 15,
    });
  });

  it('adjacent category scores 0.5 of the 60 percent sensation share', () => {
    const result = computeConcordance({
      ...exact,
      perceivedThrill: PerceivedThrill.CONTINUOUS_SOFT,
      expectedProfile: PerceivedThrill.SYSTOLIC_ROUGH,
    });
    expect(result.breakdown.sensationScorePct).toBe(30);
    expect(result.total).toBe(70);
  });

  it('two categories away or more scores 0 sensation points', () => {
    const result = computeConcordance({
      ...exact,
      perceivedThrill: PerceivedThrill.ABSENT,
      expectedProfile: PerceivedThrill.SYSTOLIC_ROUGH,
    });
    expect(result.breakdown.sensationScorePct).toBe(0);
    expect(result.total).toBe(40);
  });

  it('intensity one level off scores 18.75 of the 25 percent intensity share', () => {
    const result = computeConcordance({ ...exact, perceivedIntensity: 2, measuredIntensityLevel: 3 });
    expect(result.breakdown.intensityScorePct).toBe(18.75);
  });

  it('the note counts for completion only, an empty note scores 0', () => {
    const result = computeConcordance({ ...exact, internNotes: '   ' });
    expect(result.breakdown.notesScorePct).toBe(0);
    expect(result.total).toBe(85);
  });

  it('expected profiles per clamp setting exist and are labelled a calibrer', () => {
    for (const clamp of [0, 30, 50, 75]) {
      expect(Object.values(PerceivedThrill)).toContain(expectedProfileFor(clamp));
    }
    expect(EXPECTED_PROFILE_LABEL).toBe('profil attendu : à calibrer');
  });

  it('placeholder measured intensity rises with the rms ratio to the 0 percent reference', () => {
    expect(placeholderIntensityLevel(0.09, 450)).toBe(1);
    expect(placeholderIntensityLevel(0.13, 450)).toBe(2);
    expect(placeholderIntensityLevel(0.25, 450)).toBe(5);
  });

  it('[UC10] [UC11] computes a concordance report from labelled synthetic CSV fixtures', () => {
    const report = analyzeBenchCsv([
      'clamp_stenosis_pct,pump_flow_ml_min,perceived_thrill,perceived_intensity,intern_notes,measured_intensity_level',
      '0,450,CONTINUOUS_SOFT,3,frémissement régulier,3',
      '50,450,SYSTOLIC_ROUGH,2,,3',
    ].join('\n'));

    expect(report.synthetic).toBe(true);
    expect(report.rowCount).toBe(2);
    expect(report.meanConcordancePct).toBe(89.38);
    expect(report.rows.map((row) => row.concordance.total)).toEqual([100, 78.75]);
  });
});
