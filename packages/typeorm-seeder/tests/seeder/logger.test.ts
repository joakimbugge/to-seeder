import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';
import type { SeederLogger } from '../../src';
import type { SeedContext } from '../../src';
import { runSeeders, Seeder } from '../../src';
import { ConsoleLogger } from '../../src/seeder/logger.js';

describe('logging', () => {
  // dataSource has TypeORM logging disabled — used to verify that
  // logging: 'typeorm' still calls the TypeORM logger even when suppressed.
  let dataSource: DataSource;

  // loggingSource has TypeORM logging enabled — used to verify routing.
  let loggingSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [],
    });

    loggingSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: ['log', 'warn'],
      entities: [],
    });

    await dataSource.initialize();
    await loggingSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }

    if (loggingSource.isInitialized) {
      await loggingSource.destroy();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces no output by default', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    @Seeder()
    class LogDefaultSeeder {
      async run(_ctx: SeedContext) {}
    }

    await runSeeders([LogDefaultSeeder], {});

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs a start and done message via console when logging is true', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    @Seeder()
    class LogTrueSeeder {
      async run(_ctx: SeedContext) {}
    }

    await runSeeders([LogTrueSeeder], { logging: true });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[LogTrueSeeder]'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Starting'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Done'));
  });

  it('logs a failure message via console.warn when logging is true and a seeder throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    @Seeder()
    class LogErrorSeeder {
      async run(_ctx: SeedContext) {
        throw new Error('oops');
      }
    }

    await expect(runSeeders([LogErrorSeeder], { logging: true })).rejects.toThrow();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[LogErrorSeeder]'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed'));
  });

  it('uses a custom logger when logging is true and logger is provided', async () => {
    const custom: SeederLogger = {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    @Seeder()
    class CustomLogSeeder {
      async run(_ctx: SeedContext) {}
    }

    await runSeeders([CustomLogSeeder], { logging: true, logger: custom });

    expect(custom.log).toHaveBeenCalledWith(expect.stringContaining('[CustomLogSeeder]'));
    expect(custom.log).toHaveBeenCalledWith(expect.stringContaining('Starting'));
    expect(custom.log).toHaveBeenCalledWith(expect.stringContaining('Done'));
  });

  it('suppresses all console output when logging is false', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    @Seeder()
    class SilentSeeder {
      async run(_ctx: SeedContext) {}
    }

    await runSeeders([SilentSeeder], { logging: false });

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('suppresses the failure message when logging is false', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    @Seeder()
    class SilentErrorSeeder {
      async run(_ctx: SeedContext) {
        throw new Error('silent');
      }
    }

    await expect(runSeeders([SilentErrorSeeder], { logging: false })).rejects.toThrow();

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("routes logging through the TypeORM logger when logging is 'typeorm'", async () => {
    const loggerSpy = vi.spyOn(loggingSource.logger, 'log');

    @Seeder()
    class TypeOrmLogSeeder {
      async run(_ctx: SeedContext) {}
    }

    await runSeeders([TypeOrmLogSeeder], { dataSource: loggingSource, logging: 'typeorm' });

    expect(loggerSpy).toHaveBeenCalledWith('log', expect.stringContaining('[TypeOrmLogSeeder]'));
    expect(loggerSpy).toHaveBeenCalledWith('log', expect.stringContaining('Starting'));
    expect(loggerSpy).toHaveBeenCalledWith('log', expect.stringContaining('Done'));
  });

  it("logs a failure at warn level through the TypeORM logger when logging is 'typeorm'", async () => {
    const loggerSpy = vi.spyOn(loggingSource.logger, 'log');

    @Seeder()
    class TypeOrmWarnSeeder {
      async run(_ctx: SeedContext) {
        throw new Error('fail');
      }
    }

    await expect(
      runSeeders([TypeOrmWarnSeeder], { dataSource: loggingSource, logging: 'typeorm' }),
    ).rejects.toThrow();

    expect(loggerSpy).toHaveBeenCalledWith('warn', expect.stringContaining('[TypeOrmWarnSeeder]'));
  });

  it('does not call the TypeORM logger when logging is false', async () => {
    const loggerSpy = vi.spyOn(loggingSource.logger, 'log');

    @Seeder()
    class TypeOrmSilentSeeder {
      async run(_ctx: SeedContext) {}
    }

    await runSeeders([TypeOrmSilentSeeder], { dataSource: loggingSource, logging: false });

    expect(loggerSpy).not.toHaveBeenCalled();
  });

  it("calls the TypeORM logger when logging is 'typeorm' even if TypeORM logging is disabled — suppression happens inside TypeORM", async () => {
    const loggerSpy = vi.spyOn(dataSource.logger, 'log');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    @Seeder()
    class TypeOrmDisabledLogSeeder {
      async run(_ctx: SeedContext) {}
    }

    await runSeeders([TypeOrmDisabledLogSeeder], { dataSource, logging: 'typeorm' });

    expect(loggerSpy).toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("produces no output when logging is 'typeorm' and no dataSource is provided", async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    @Seeder()
    class TypeOrmNoSourceSeeder {
      async run(_ctx: SeedContext) {}
    }

    await runSeeders([TypeOrmNoSourceSeeder], { logging: 'typeorm' });

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('ConsoleLogger', () => {
  it('delegates each method to the corresponding console method', () => {
    const logger = new ConsoleLogger();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    logger.log('log');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');
    logger.debug('debug');

    expect(logSpy).toHaveBeenCalledWith('log');
    expect(infoSpy).toHaveBeenCalledWith('info');
    expect(warnSpy).toHaveBeenCalledWith('warn');
    expect(errorSpy).toHaveBeenCalledWith('error');
    expect(debugSpy).toHaveBeenCalledWith('debug');

    vi.restoreAllMocks();
  });
});
