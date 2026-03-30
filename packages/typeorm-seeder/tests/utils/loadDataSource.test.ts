import 'reflect-metadata';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDataSource } from '../../src/utils/loadDataSource.js';
import { mockExit } from './mockExit.js';

const fixturesDir = path.resolve(fileURLToPath(import.meta.url), '../../fixtures');
const datasourcePath = path.resolve(fixturesDir, 'datasources/FixtureDataSource.ts');
const missingPath = path.resolve(fixturesDir, 'nonexistent.js');

describe('loadDataSource()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('exits when the datasource file does not exist', async () => {
    const exitSpy = mockExit();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(loadDataSource(missingPath)).rejects.toThrow('process.exit');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('resolves and initializes a DataSource from an explicit path', async () => {
    const ds = await loadDataSource(datasourcePath);

    expect(ds.isInitialized).toBe(true);

    await ds.destroy();
  });

  it('exits when no path is provided and no config file exists in cwd', async () => {
    const exitSpy = mockExit();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'cwd').mockReturnValue('/nonexistent-dir-loadds-test');

    await expect(loadDataSource()).rejects.toThrow('process.exit');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('No DataSource found'));
  });
});
