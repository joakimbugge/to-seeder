import 'reflect-metadata';
import path from 'path';
import { fileURLToPath } from 'url';
import { FixtureAuthorSeeder } from '../fixtures/seeders/FixtureAuthorSeeder.js';
import { FixtureBookSeeder } from '../fixtures/seeders/FixtureBookSeeder.js';
import { loadSeeders } from '../../src/index.js';

const fixturesDir = path
  .resolve(fileURLToPath(import.meta.url), '../../fixtures/seeders')
  .replace(/\\/g, '/');

describe('loadSeeders()', () => {
  it('passes constructor entries through as-is', async () => {
    const result = await loadSeeders([FixtureAuthorSeeder, FixtureBookSeeder]);

    expect(result).toEqual([FixtureAuthorSeeder, FixtureBookSeeder]);
  });

  it('expands a glob pattern and returns the decorated seeder constructors', async () => {
    const result = await loadSeeders([`${fixturesDir}/*.ts`]);

    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([FixtureAuthorSeeder, FixtureBookSeeder]));
  });

  it('handles a mixed array of constructors and glob patterns', async () => {
    const result = await loadSeeders([FixtureAuthorSeeder, `${fixturesDir}/FixtureBookSeeder.ts`]);

    expect(result).toHaveLength(2);
    expect(result).toContain(FixtureAuthorSeeder);
    expect(result).toContain(FixtureBookSeeder);
  });

  it('ignores exported constructors not decorated with @Seeder', async () => {
    const result = await loadSeeders([`${fixturesDir}/../entities/*.ts`]);

    expect(result).toEqual([]);
  });

  it('returns an empty array when no patterns match', async () => {
    const result = await loadSeeders([`${fixturesDir}/nonexistent-*.ts`]);

    expect(result).toEqual([]);
  });

  it('returns an empty array for an empty input', async () => {
    const result = await loadSeeders([]);

    expect(result).toEqual([]);
  });
});
