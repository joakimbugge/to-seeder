import 'reflect-metadata';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Entity, PrimaryKey } from '@mikro-orm/decorators/legacy';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import type { SeederLogger } from '../../src';
import type { SeedContext } from '../../src';
import { runSeeders, Seeder } from '../../src';
import { ConsoleLogger } from '../../src/seeder/logger.js';

// MikroORM requires at least one entity to initialize.
@Entity()
class Placeholder {
  @PrimaryKey()
  id!: number;
}

describe('logging', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      metadataProvider: ReflectMetadataProvider,
      entities: [Placeholder],
      dbName: ':memory:',
      driver: SqliteDriver,
    });
    await orm.schema.create();
  });

  afterAll(async () => {
    await orm.close();
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

  it("routes logging through the MikroORM logger when logging is 'mikroorm'", async () => {
    const em = orm.em.fork();
    const loggerSpy = vi.spyOn(em.config.getLogger(), 'log');

    @Seeder()
    class MikroOrmLogSeeder {
      async run(_ctx: SeedContext) {}
    }

    await runSeeders([MikroOrmLogSeeder], { em, logging: 'mikroorm' });

    expect(loggerSpy).toHaveBeenCalledWith('info', expect.stringContaining('[MikroOrmLogSeeder]'));
    expect(loggerSpy).toHaveBeenCalledWith('info', expect.stringContaining('Starting'));
    expect(loggerSpy).toHaveBeenCalledWith('info', expect.stringContaining('Done'));
  });

  it("logs a failure at warn level through the MikroORM logger when logging is 'mikroorm'", async () => {
    const em = orm.em.fork();
    const warnSpy = vi.spyOn(em.config.getLogger(), 'warn');

    @Seeder()
    class MikroOrmWarnSeeder {
      async run(_ctx: SeedContext) {
        throw new Error('fail');
      }
    }

    await expect(runSeeders([MikroOrmWarnSeeder], { em, logging: 'mikroorm' })).rejects.toThrow();

    expect(warnSpy).toHaveBeenCalledWith('info', expect.stringContaining('[MikroOrmWarnSeeder]'));
  });

  it("calls the MikroORM logger when logging is 'mikroorm' even if MikroORM debug is disabled — suppression happens inside MikroORM", async () => {
    const em = orm.em.fork();
    const loggerSpy = vi.spyOn(em.config.getLogger(), 'log');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    em.config.getLogger().setDebugMode(false);

    @Seeder()
    class MikroOrmDisabledLogSeeder {
      async run(_ctx: SeedContext) {}
    }

    await runSeeders([MikroOrmDisabledLogSeeder], { em, logging: 'mikroorm' });

    expect(loggerSpy).toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("produces no output when logging is 'mikroorm' and no em is provided", async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    @Seeder()
    class MikroOrmNoEmSeeder {
      async run(_ctx: SeedContext) {}
    }

    await runSeeders([MikroOrmNoEmSeeder], { logging: 'mikroorm' });

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
