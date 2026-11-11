import { BadRequestException } from '@nestjs/common';
import { PerceivedThrill } from '@prisma/client';
import { CLINICAL_DISCLAIMER } from '../../common/constants.js';
import { computeConcordance, expectedProfileFor } from './bench.concordance.js';

const REQUIRED = [
  'clamp_stenosis_pct',
  'pump_flow_ml_min',
  'perceived_thrill',
  'perceived_intensity',
  'measured_intensity_level',
] as const;
const PERSONAL_COLUMN = /(^|_)(name|nom|prenom|first_name|last_name|cin|birth|date_of_birth|naissance|phone|telephone|address|adresse|email|patient|id_patient)(_|$)/;

export interface BenchReportRow {
  line: number;
  concordance: ReturnType<typeof computeConcordance>;
}

export interface BenchConcordanceReport {
  synthetic: true;
  disclaimer: string;
  rowCount: number;
  meanConcordancePct: number;
  rows: BenchReportRow[];
}

function csvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value); value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[i + 1] === '\n') i += 1;
      row.push(value); value = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else value += char;
  }
  if (quoted) throw new BadRequestException('CSV mal formé : guillemet non fermé');
  row.push(value);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
}

function fail(message: string): never {
  throw new BadRequestException(message);
}

export function analyzeBenchCsv(csv: string): BenchConcordanceReport {
  const records = csvRows(csv);
  if (records.length < 2) fail('Le CSV doit contenir un en-tête et au moins une ligne');
  const headers = records[0].map((header) => header.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  if (headers.some((header) => PERSONAL_COLUMN.test(header))) fail('Colonne de donnée personnelle interdite');
  for (const header of REQUIRED) if (!headers.includes(header)) fail(`Colonne obligatoire absente : ${header}`);
  const index = (name: string) => headers.indexOf(name);
  const rows = records.slice(1).map((cells, rowOffset) => {
    if (cells.length !== headers.length) fail(`Nombre de colonnes invalide à la ligne ${rowOffset + 2}`);
    const number = (name: string) => Number(cells[index(name)]);
    const clamp = number('clamp_stenosis_pct');
    const flow = number('pump_flow_ml_min');
    const intensity = number('perceived_intensity');
    const measured = number('measured_intensity_level');
    const thrill = cells[index('perceived_thrill')] as PerceivedThrill;
    if (![0, 30, 50, 75].includes(clamp) || !Number.isFinite(flow) || flow <= 0 || !Number.isInteger(intensity) || intensity < 1 || intensity > 5 || !Number.isInteger(measured) || measured < 1 || measured > 5 || !Object.values(PerceivedThrill).includes(thrill)) {
      fail(`Valeur invalide à la ligne ${rowOffset + 2}`);
    }
    return {
      line: rowOffset + 2,
      concordance: computeConcordance({
        perceivedThrill: thrill,
        perceivedIntensity: intensity,
        internNotes: index('intern_notes') < 0 ? null : cells[index('intern_notes')],
        expectedProfile: expectedProfileFor(clamp),
        measuredIntensityLevel: measured,
      }),
    };
  });
  const mean = rows.reduce((sum, row) => sum + row.concordance.total, 0) / rows.length;
  return { synthetic: true, disclaimer: CLINICAL_DISCLAIMER, rowCount: rows.length, meanConcordancePct: Math.round(mean * 100) / 100, rows };
}
