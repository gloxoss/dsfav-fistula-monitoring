import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');

// Forbidden substrings in data field names (Prisma and OpenAPI schema properties).
// A field that contains any of these (case-insensitive) fails the PSEUDO-SCAN gate.
// Intent: prevent personal data fields (patient or user identity) from entering the schema.
export const FORBIDDEN_PATTERNS = [
  /name/i,
  /\bnom\b/i,
  /prenom/i,
  /\bcin\b/i,
  /birth/i,
  /naissance/i,
  /phone/i,
  /address/i,
];

// Technical fields that contain a forbidden substring but are not personal data.
export const ALLOWED_TECHNICAL = new Set([
  'macAddress',      // device hardware identifier, not a person's address
  'idempotencyKey',  // internal sync key
  'serialNumber',    // device serial, not personal
  'fistulaType',     // clinical classification, not personal identity
]);

export const ALLOWED_SCHEMA_PROPERTIES: Record<string, Set<string>> = {
  AiEvidenceValue: new Set(['name']),
};

export function isForbidden(fieldName: string): boolean {
  if (ALLOWED_TECHNICAL.has(fieldName)) return false;
  return FORBIDDEN_PATTERNS.some((re) => re.test(fieldName));
}

export function scanPrismaSchema(schema: string): string[] {
  const lines = schema.split('\n');
  const hits: string[] = [];
  for (const [i, line] of lines.entries()) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('model') ||
      trimmed.startsWith('enum') ||
      trimmed.startsWith('@') ||
      trimmed.startsWith('}') ||
      trimmed.startsWith('generator') ||
      trimmed.startsWith('datasource')
    ) {
      continue;
    }
    // A Prisma field line starts with an identifier followed by a type (the field name is the first token).
    const fieldName = trimmed.split(/\s+/)[0];
    if (isForbidden(fieldName)) {
      hits.push(`line ${i + 1}: ${line.trim()}`);
    }
  }
  return hits;
}

// Structural YAML keys that are part of the OpenAPI spec format for schema property definitions.
// Note: 'name' and 'in' are explicitly excluded here; they are keywords only in parameter objects,
// never valid structural keys under a 'properties:' mapping.
export const PROPERTY_STRUCTURAL_KEYS = new Set([
  'type', 'format', 'description', 'summary', 'operationId', 'required',
  'properties', 'items', 'schema', 'content', 'responses', 'requestBody',
  'parameters', 'example', 'enum', 'ref', '$ref', 'allOf', 'oneOf', 'anyOf',
  'nullable', 'default', 'minimum', 'maximum', 'minLength', 'maxLength',
  'pattern', 'additionalProperties', 'exclusiveMinimum', 'exclusiveMaximum',
  'multipleOf', 'uniqueItems', 'minItems', 'maxItems', 'minProperties',
  'maxProperties', 'readOnly', 'writeOnly', 'xml', 'examples', 'encoding',
  'headers', 'deprecated',
]);

function extractFlowProperties(line: string): string[] {
  const match = line.match(/properties:\s*\{(.*)\}/);
  if (!match) return [];
  const inside = match[1];
  const keys: string[] = [];
  let depth = 0;
  let currentKey = '';
  let inKey = true;

  for (let i = 0; i < inside.length; i++) {
    const char = inside[i];
    if (char === '{') {
      depth++;
      inKey = false;
    } else if (char === '}') {
      depth--;
      if (depth === 0) inKey = true;
    } else if (char === ',' && depth === 0) {
      inKey = true;
      currentKey = '';
    } else if (char === ':' && depth === 0 && inKey) {
      const key = currentKey.trim().replace(/^['"]|['"]$/g, '');
      if (key) keys.push(key);
      currentKey = '';
      inKey = false;
    } else if (inKey) {
      currentKey += char;
    }
  }
  return keys;
}

export function scanOpenApiYaml(yaml: string): string[] {
  const lines = yaml.split('\n');
  const hits: string[] = [];

  // Track current schema name under components.schemas
  let currentSchema = '';

  // Track nested properties blocks with their indentations
  const propertiesStack: { indent: number; propIndent?: number }[] = [];
  // Track parameters blocks separately
  const parametersStack: { indent: number }[] = [];

  for (const [i, line] of lines.entries()) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    const trimmed = line.trim();

    if (indent <= 2) {
      currentSchema = '';
    } else if (indent === 4) {
      const schemaMatch = line.match(/^ {4}([a-zA-Z0-9_$]+):\s*$/);
      if (schemaMatch) {
        currentSchema = schemaMatch[1];
      }
    }

    // Reset stacks when indentation retreats past the block header
    while (propertiesStack.length > 0 && indent <= propertiesStack[propertiesStack.length - 1].indent) {
      propertiesStack.pop();
    }
    while (parametersStack.length > 0 && indent <= parametersStack[parametersStack.length - 1].indent) {
      parametersStack.pop();
    }

    // 1. Entering a properties block
    if (trimmed === 'properties:') {
      propertiesStack.push({ indent });
      continue;
    } else if (trimmed.startsWith('properties:')) {
      // Inline flow mapping, e.g. properties: { name: { type: string } }
      const flowKeys = extractFlowProperties(trimmed);
      for (const k of flowKeys) {
        const allowed = ALLOWED_SCHEMA_PROPERTIES[currentSchema]?.has(k);
        if (!PROPERTY_STRUCTURAL_KEYS.has(k) && !allowed && isForbidden(k)) {
          hits.push(`line ${i + 1}: ${trimmed}`);
        }
      }
      continue;
    }

    // 2. Entering a parameters block (separate context)
    if (trimmed === 'parameters:') {
      parametersStack.push({ indent });
      continue;
    } else if (trimmed.startsWith('parameters:')) {
      // Flow parameters, e.g. parameters: [{ name: patientName, in: query }]
      const paramMatches = trimmed.matchAll(/name:\s*['"]?([a-zA-Z0-9_$]+)['"]?/g);
      for (const m of paramMatches) {
        if (isForbidden(m[1])) {
          hits.push(`line ${i + 1}: parameter name "${m[1]}" is forbidden: ${trimmed}`);
        }
      }
      continue;
    }

    // 3. Inside a parameters block: 'name' and 'in' are keywords of the parameter object
    if (parametersStack.length > 0) {
      const paramMatch = trimmed.match(/^(?:-\s*)?name:\s*['"]?([a-zA-Z0-9_$]+)['"]?/);
      if (paramMatch) {
        const paramName = paramMatch[1];
        if (isForbidden(paramName)) {
          hits.push(`line ${i + 1}: parameter name "${paramName}" is forbidden: ${trimmed}`);
        }
      }
    }

    // 4. Inside a properties block: keys at propIndent are property names
    if (propertiesStack.length > 0) {
      const top = propertiesStack[propertiesStack.length - 1];
      if (indent > top.indent) {
        if (top.propIndent === undefined) {
          const keyMatch = trimmed.match(/^['"]?([a-zA-Z_$][a-zA-Z0-9_$]*)['"]?:/);
          if (keyMatch) {
            top.propIndent = indent;
          }
        }
        if (indent === top.propIndent) {
          const keyMatch = trimmed.match(/^['"]?([a-zA-Z_$][a-zA-Z0-9_$]*)['"]?:/);
          if (keyMatch) {
            const key = keyMatch[1];
            const allowed = ALLOWED_SCHEMA_PROPERTIES[currentSchema]?.has(key);
            if (!PROPERTY_STRUCTURAL_KEYS.has(key) && !allowed && isForbidden(key)) {
              hits.push(`line ${i + 1}: ${trimmed}`);
            }
          }
        }
      }
    }
  }

  return hits;
}

describe('[PSEUDO-SCAN] No PII field names in schema or API contract', () => {
  it('[PSEUDO-SCAN] Prisma schema contains no forbidden field name', () => {
    const schema = readFileSync(
      join(repoRoot, 'apps/api-nestjs/prisma/schema.prisma'),
      'utf-8',
    );
    expect(scanPrismaSchema(schema)).toEqual([]);
  });

  it('[PSEUDO-SCAN] Prisma DMMF contains no forbidden field name', () => {
    const hits: string[] = [];
    for (const model of Prisma.dmmf.datamodel.models) {
      for (const field of model.fields) {
        if (isForbidden(field.name)) {
          hits.push(`model ${model.name}.${field.name}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('[PSEUDO-SCAN] OpenAPI yaml contains no forbidden field name', () => {
    const yaml = readFileSync(
      join(repoRoot, 'packages/shared-types/openapi.yaml'),
      'utf-8',
    );
    expect(scanOpenApiYaml(yaml)).toEqual([]);
  });

  it('[PSEUDO-SCAN] scanner fails on in-memory OpenAPI schema containing properties: { name: { type: string } }', () => {
    const inlineYaml = 'properties: { name: { type: string } }';
    const inlineHits = scanOpenApiYaml(inlineYaml);
    expect(inlineHits.length).toBeGreaterThan(0);
    expect(inlineHits.some((h) => h.includes('name'))).toBe(true);

    const blockYaml = `
components:
  schemas:
    Sample:
      type: object
      properties:
        name:
          type: string
`;
    const blockHits = scanOpenApiYaml(blockYaml);
    expect(blockHits.length).toBeGreaterThan(0);
    expect(blockHits.some((h) => h.includes('name'))).toBe(true);
  });

  it('[PSEUDO-SCAN] scanner fails on in-memory Prisma schema with forbidden field name firstName', () => {
    const badPrisma = `
model Patient {
  id        String   @id @default(uuid())
  firstName String
}
`;
    const hits = scanPrismaSchema(badPrisma);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.includes('firstName'))).toBe(true);
  });

  it('[PSEUDO-SCAN] seed.ts and DSFAV_FIXTURE.md contain no personal-data fields', () => {
    const seedPath = join(repoRoot, 'apps/api-nestjs/prisma/seed.ts');
    const fixturePath = join(repoRoot, 'apps/api-nestjs/test/fixtures/DSFAV_FIXTURE.md');

    const seedContent = readFileSync(seedPath, 'utf-8');
    const fixtureContent = readFileSync(fixturePath, 'utf-8');

    expect(scanFixturesForPii(seedContent, 'seed.ts')).toEqual([]);
    expect(scanFixturesForPii(fixtureContent, 'DSFAV_FIXTURE.md')).toEqual([]);
  });

  it('[PSEUDO-SCAN] scanner detects PII leaked in simulated fixtures, logs and error bodies', () => {
    const badFixture = 'INSERT INTO Patient (id, patientName) VALUES (1, "Doe");';
    expect(scanFixturesForPii(badFixture, 'badFixture').length).toBeGreaterThan(0);

    const badLog = '[ERROR] Failed lookup for patientName=Alice birthDate=1980-01-01';
    expect(scanPayloadForPii(badLog, 'log').length).toBeGreaterThan(0);

    const badErrorBody = {
      code: 'VALIDATION_ERROR',
      message_fr: 'Erreur',
      patientPhone: '+33600000000',
    };
    expect(scanPayloadForPii(badErrorBody).length).toBeGreaterThan(0);
  });

  it('[PSEUDO-SCAN] API error responses and logs during capture contain no personal data', async () => {
    const { HttpExceptionFilter } = await import('../src/common/http-exception.filter.js');
    const { BadRequestException, UnauthorizedException, ForbiddenException, NotFoundException } = await import('@nestjs/common');

    const filter = new HttpExceptionFilter();
    const responses: any[] = [];
    const createMockHost = (statusRef: { status: number }) => ({
      switchToHttp: () => ({
        getResponse: () => ({
          status: (s: number) => {
            statusRef.status = s;
            return {
              json: (body: any) => responses.push(body),
            };
          },
        }),
      }),
    });

    // 1. Test validation error with multiple messages
    const statusRef = { status: 0 };
    filter.catch(
      new BadRequestException({
        code: 'INVALID_INPUT',
        message: ['fistulaType must be a valid enum value', 'armSide must be LEFT or RIGHT'],
        retryable: false,
      }),
      createMockHost(statusRef) as any,
    );

    // 2. Test 401 unauthorized
    filter.catch(
      new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message_fr: 'Identifiants invalides ou session expirée',
        retryable: false,
      }),
      createMockHost(statusRef) as any,
    );

    // 3. Test 403 forbidden
    filter.catch(
      new ForbiddenException({
        code: 'FORBIDDEN',
        message_fr: 'Accès refusé pour ce profil',
        retryable: false,
      }),
      createMockHost(statusRef) as any,
    );

    // 4. Test 404 patient unknown
    filter.catch(
      new NotFoundException({
        code: 'PATIENT_UNKNOWN',
        message_fr: 'Patient PT-CAS-9277 introuvable dans le dossier',
        retryable: false,
      }),
      createMockHost(statusRef) as any,
    );

    // 5. Test 500 internal error with Error instance
    filter.catch(new Error('Erreur de traitement DSP'), createMockHost(statusRef) as any);

    // Verify all generated error response bodies contain zero PII
    for (const body of responses) {
      expect(scanPayloadForPii(body)).toEqual([]);
    }

    // 6. Test sample capture logs
    const sampleLogs = [
      '[Capture] Démarrage acquisition pour patient idPseudo=PT-CAS-8841 sur device dev-01-001',
      '[DSP] Trame reçue : 25 s, 25000 échantillons ADXL, pression moyenne 5.2 kPa',
      '[Sync] IdempotencyKey=sync-8841-001 statut=SYNCED',
    ];
    for (const logLine of sampleLogs) {
      expect(scanPayloadForPii(logLine, 'log')).toEqual([]);
    }
  });
});

export function scanFixturesForPii(content: string, filename: string): string[] {
  const lines = content.split('\n');
  const hits: string[] = [];
  for (const [i, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    const piiMatch = trimmed.match(/\b(?:patientName|patient_name|nomPatient|nom_patient|prenomPatient|prenom_patient|birthDate|birth_date|dateNaissance|date_naissance|patientPhone|patient_phone|patientAddress|patient_address)\b/i);
    if (piiMatch) {
      hits.push(`${filename}:${i + 1}: contains personal data identifier "${piiMatch[0]}"`);
    }
  }
  return hits;
}

export function scanPayloadForPii(data: unknown, path = ''): string[] {
  if (data === null || data === undefined) return [];
  const hits: string[] = [];

  if (typeof data === 'string') {
    const forbiddenPatterns = [
      /\b(?:patientName|patient_name|nomPatient|nom_patient|prenomPatient|prenom_patient)\b/i,
      /\b(?:birthDate|birth_date|dateNaissance|date_naissance)\b/i,
      /\b(?:patientPhone|patient_phone|patientAddress|patient_address)\b/i,
    ];
    for (const re of forbiddenPatterns) {
      if (re.test(data)) {
        hits.push(`${path}: contains PII pattern "${re.source}" in string value`);
      }
    }
  } else if (Array.isArray(data)) {
    data.forEach((item, index) => {
      hits.push(...scanPayloadForPii(item, `${path}[${index}]`));
    });
  } else if (typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (isForbidden(k)) {
        hits.push(`${path ? `${path}.${k}` : k}: forbidden PII field name`);
      }
      hits.push(...scanPayloadForPii(v, path ? `${path}.${k}` : k));
    }
  }
  return hits;
}
