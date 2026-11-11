import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEnvironment,
  buildResetQueries,
  ALLOWED_TABLES,
  FORBIDDEN_TABLES,
} from './reset-demo.mjs';

describe('reset-demo safety checks', () => {
  it('[UC1] reset-demo refuses without --yes flag', () => {
    assert.throws(
      () => validateEnvironment({ databaseUrl: 'postgresql://dsfav:secret@localhost:5433/dsfav', hasYes: false }),
      /--yes/
    );
  });

  it('[UC1] reset-demo refuses non-local database host', () => {
    const nonLocalUrls = [
      'postgresql://dsfav:secret@db.example.com:5432/dsfav',
      'postgresql://dsfav:secret@192.168.1.50:5432/dsfav',
      'postgresql://dsfav:secret@10.0.0.5:5432/dsfav',
      'postgresql://dsfav:secret@rds.amazonaws.com:5432/dsfav',
    ];

    for (const url of nonLocalUrls) {
      assert.throws(
        () => validateEnvironment({ databaseUrl: url, hasYes: true }),
        /localhost|127\.0\.0\.1/
      );
    }
  });

  it('[UC1] reset-demo accepts localhost and 127.0.0.1', () => {
    const validLocal = [
      'postgresql://dsfav:secret@localhost:5433/dsfav',
      'postgresql://dsfav:secret@127.0.0.1:5433/dsfav',
    ];

    for (const url of validLocal) {
      const res = validateEnvironment({ databaseUrl: url, hasYes: true });
      assert.equal(res.isLocal, true);
      assert.equal(res.hasYes, true);
    }
  });

  it('[UC1] reset-demo SQL statements are strictly limited to demo tables and protect User, Device, ConfigVersion', () => {
    const queries = buildResetQueries({
      demoPatientPseudos: ['PT-CAS-8841', 'PT-CAS-4471'],
      demoPatientIds: ['p-8841-001', 'p-4471-001'],
    });

    assert.ok(queries.length > 0, 'Should generate at least one query');

    for (const query of queries) {
      // Forbidden tables must never be modified
      for (const table of FORBIDDEN_TABLES) {
        const forbiddenPattern = new RegExp(`(DELETE|INSERT|UPDATE|DROP|TRUNCATE)\\s+.*["']?${table}["']?`, 'i');
        assert.equal(
          forbiddenPattern.test(query),
          false,
          `Query must not modify forbidden table ${table}: ${query}`
        );
      }

      // Check that any modified table is in ALLOWED_TABLES
      const modifyMatch = query.match(/(?:DELETE\s+FROM|INSERT\s+INTO|UPDATE)\s+["']?([A-Za-z0-9_]+)["']?/i);
      if (modifyMatch) {
        const modifiedTable = modifyMatch[1];
        assert.ok(
          ALLOWED_TABLES.includes(modifiedTable),
          `Modified table ${modifiedTable} must be in ALLOWED_TABLES`
        );
      }
    }
  });
});
