import 'reflect-metadata';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { FixtureAuthor } from '../fixtures/entities/FixtureAuthor.js';
import { FixtureBook } from '../fixtures/entities/FixtureBook.js';
import { loadEntities } from '@joakimbugge/seeder';

const fixturesDir = path
  .resolve(fileURLToPath(import.meta.url), '../../fixtures/entities')
  .replace(/\\/g, '/');

describe('loadEntities()', () => {
  it('passes constructor entries through as-is', async () => {
    const result = await loadEntities([FixtureAuthor, FixtureBook]);

    expect(result).toEqual([FixtureAuthor, FixtureBook]);
  });

  it('expands a glob pattern and returns the exported constructors', async () => {
    const result = await loadEntities([`${fixturesDir}/*.ts`]);

    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([FixtureAuthor, FixtureBook]));
  });

  it('handles a mixed array of constructors and glob patterns', async () => {
    const result = await loadEntities([FixtureAuthor, `${fixturesDir}/FixtureBook.ts`]);

    expect(result).toHaveLength(2);
    expect(result).toContain(FixtureAuthor);
    expect(result).toContain(FixtureBook);
  });

  it('returns an empty array when no patterns match', async () => {
    const result = await loadEntities([`${fixturesDir}/nonexistent-*.ts`]);

    expect(result).toEqual([]);
  });

  it('returns an empty array for an empty input', async () => {
    const result = await loadEntities([]);

    expect(result).toEqual([]);
  });
});
