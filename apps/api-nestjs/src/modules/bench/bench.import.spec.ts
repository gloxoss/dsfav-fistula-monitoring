import { analyzeBenchCsv } from './bench.import.js';

describe('bench CSV import', () => {
  it('[PSEUDO-SCAN] rejects any personal-data column', () => {
    expect(() =>
      analyzeBenchCsv(
        [
          'clamp_stenosis_pct,pump_flow_ml_min,perceived_thrill,perceived_intensity,measured_intensity_level,nom',
          '0,450,CONTINUOUS_SOFT,3,3,Exemple',
        ].join('\n'),
      ),
    ).toThrow('Colonne de donnée personnelle interdite');
  });
});
