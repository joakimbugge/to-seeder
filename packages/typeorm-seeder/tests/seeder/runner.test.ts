import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Column, DataSource, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { SeedContext } from '../../src';
import { runSeeders, saveMany, Seed, Seeder } from '../../src';
import { registerSeeder } from '../../src/seeder/registry.js';
import type { SeederCtor } from '../../src/seeder/runner.js';

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

@Entity()
class SeedUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Column({ type: 'text' })
  name!: string;
}

@Entity()
class SeedPost {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.sentence())
  @Column({ type: 'text' })
  title!: string;
}

@Entity()
class SeedComment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.lorem.words(5))
  @Column({ type: 'text' })
  body!: string;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('seeder suites', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [SeedUser, SeedPost, SeedComment],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('skip', () => {
    it('does not run a seeder when skip returns true', async () => {
      const spy = vi.fn();

      @Seeder()
      class SkippedSeeder {
        async run(_ctx: SeedContext) {
          spy();
        }
      }

      await runSeeders([SkippedSeeder], { logging: false, skip: () => true });

      expect(spy).not.toHaveBeenCalled();
    });

    it('runs a seeder when skip returns false', async () => {
      const spy = vi.fn();

      @Seeder()
      class NotSkippedSeeder {
        async run(_ctx: SeedContext) {
          spy();
        }
      }

      await runSeeders([NotSkippedSeeder], { logging: false, skip: () => false });

      expect(spy).toHaveBeenCalledOnce();
    });

    it('receives the seeder constructor', async () => {
      let received: SeederCtor | undefined;

      @Seeder()
      class SkipArgSeeder {
        async run(_ctx: SeedContext) {}
      }

      await runSeeders([SkipArgSeeder], {
        logging: false,
        skip: (seeder) => {
          received = seeder;
          return false;
        },
      });

      expect(received).toBe(SkipArgSeeder);
    });

    it('skips only the seeders for which skip returns true', async () => {
      const order: string[] = [];

      @Seeder()
      class SkipSelA {
        async run(_ctx: SeedContext) {
          order.push('A');
        }
      }

      @Seeder({ dependencies: [SkipSelA] })
      class SkipSelB {
        async run(_ctx: SeedContext) {
          order.push('B');
        }
      }

      await runSeeders([SkipSelB], {
        logging: false,
        skip: (seeder) => seeder === SkipSelA,
      });

      expect(order).toEqual(['B']);
    });

    it('does not call onBefore or onAfter for skipped seeders', async () => {
      const onBefore = vi.fn();
      const onAfter = vi.fn();

      @Seeder()
      class SkipHookSeeder {
        async run(_ctx: SeedContext) {}
      }

      await runSeeders([SkipHookSeeder], {
        logging: false,
        skip: () => true,
        onBefore,
        onAfter,
      });

      expect(onBefore).not.toHaveBeenCalled();
      expect(onAfter).not.toHaveBeenCalled();
    });
  });

  describe('basic execution', () => {
    it('runs a seeder with no dependencies', async () => {
      const spy = vi.fn();

      @Seeder()
      class StandaloneSeeder {
        async run(_ctx: SeedContext) {
          spy();
        }
      }

      await runSeeders([StandaloneSeeder], { dataSource });

      expect(spy).toHaveBeenCalledOnce();
    });

    it('passes context to the seeder', async () => {
      let received: SeedContext | undefined;

      @Seeder()
      class ContextSeeder {
        async run(ctx: SeedContext) {
          received = ctx;
        }
      }

      await runSeeders([ContextSeeder], { dataSource });

      expect(received?.dataSource).toBe(dataSource);
    });

    it('actually seeds the database', async () => {
      @Seeder()
      class UserSeeder {
        async run(ctx: SeedContext) {
          await saveMany(SeedUser, { ...ctx, dataSource: ctx.dataSource!, count: 3 });
        }
      }

      const before = await dataSource.getRepository(SeedUser).count();
      await runSeeders([UserSeeder], { dataSource });
      const after = await dataSource.getRepository(SeedUser).count();

      expect(after - before).toBe(3);
    });
  });

  describe('dependency ordering', () => {
    it('runs a dependency before the seeder that declares it', async () => {
      const order: string[] = [];

      @Seeder()
      class DepA {
        async run(_ctx: SeedContext) {
          order.push('A');
        }
      }

      @Seeder({ dependencies: [DepA] })
      class DepB {
        async run(_ctx: SeedContext) {
          order.push('B');
        }
      }

      await runSeeders([DepB], { dataSource });

      expect(order).toEqual(['A', 'B']);
    });

    it('resolves transitive dependencies in order', async () => {
      const order: string[] = [];

      @Seeder()
      class TransA {
        async run(_ctx: SeedContext) {
          order.push('A');
        }
      }

      @Seeder({ dependencies: [TransA] })
      class TransB {
        async run(_ctx: SeedContext) {
          order.push('B');
        }
      }

      @Seeder({ dependencies: [TransB] })
      class TransC {
        async run(_ctx: SeedContext) {
          order.push('C');
        }
      }

      await runSeeders([TransC], { dataSource });

      expect(order).toEqual(['A', 'B', 'C']);
    });

    it('does not run a dependency twice when it appears in both roots and as a dep', async () => {
      const spy = vi.fn();

      @Seeder()
      class SharedDep {
        async run(_ctx: SeedContext) {
          spy();
        }
      }

      @Seeder({ dependencies: [SharedDep] })
      class DependsOnShared {
        async run(_ctx: SeedContext) {}
      }

      await runSeeders([SharedDep, DependsOnShared], { dataSource });

      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('hooks', () => {
    it('calls onBefore with the seeder constructor before run()', async () => {
      const events: string[] = [];
      let receivedCtor: SeederCtor | undefined;

      @Seeder()
      class HookOrderSeeder {
        async run(_ctx: SeedContext) {
          events.push('run');
        }
      }

      await runSeeders([HookOrderSeeder], {
        logging: false,
        onBefore: (seeder) => {
          receivedCtor = seeder;
          events.push('before');
        },
      });

      expect(receivedCtor).toBe(HookOrderSeeder);
      expect(events).toEqual(['before', 'run']);
    });

    it('calls onAfter with the seeder constructor and a duration after run()', async () => {
      const events: string[] = [];
      let receivedCtor: SeederCtor | undefined;
      let receivedDuration: number | undefined;

      @Seeder()
      class HookAfterSeeder {
        async run(_ctx: SeedContext) {
          events.push('run');
        }
      }

      await runSeeders([HookAfterSeeder], {
        logging: false,
        onAfter: (seeder, durationMs) => {
          receivedCtor = seeder;
          receivedDuration = durationMs;
          events.push('after');
        },
      });

      expect(receivedCtor).toBe(HookAfterSeeder);
      expect(receivedDuration).toBeGreaterThanOrEqual(0);
      expect(events).toEqual(['run', 'after']);
    });

    it('fires onBefore, run, onAfter in order', async () => {
      const events: string[] = [];

      @Seeder()
      class FullOrderSeeder {
        async run(_ctx: SeedContext) {
          events.push('run');
        }
      }

      await runSeeders([FullOrderSeeder], {
        logging: false,
        onBefore: () => {
          events.push('before');
        },
        onAfter: () => {
          events.push('after');
        },
      });

      expect(events).toEqual(['before', 'run', 'after']);
    });

    it('calls onBefore and onAfter once per seeder in execution order', async () => {
      const beforeOrder: string[] = [];
      const afterOrder: string[] = [];

      @Seeder()
      class HookDepA {
        async run(_ctx: SeedContext) {}
      }

      @Seeder({ dependencies: [HookDepA] })
      class HookDepB {
        async run(_ctx: SeedContext) {}
      }

      await runSeeders([HookDepB], {
        logging: false,
        onBefore: (seeder) => {
          beforeOrder.push(seeder.name);
        },
        onAfter: (seeder) => {
          afterOrder.push(seeder.name);
        },
      });

      expect(beforeOrder).toEqual(['HookDepA', 'HookDepB']);
      expect(afterOrder).toEqual(['HookDepA', 'HookDepB']);
    });

    it('calls onError with the seeder constructor and the thrown error', async () => {
      const boom = new Error('boom');
      let receivedCtor: SeederCtor | undefined;
      let receivedError: unknown;

      @Seeder()
      class FailingSeeder {
        async run(_ctx: SeedContext) {
          throw boom;
        }
      }

      await expect(
        runSeeders([FailingSeeder], {
          logging: false,
          onError: (seeder, err) => {
            receivedCtor = seeder;
            receivedError = err;
          },
        }),
      ).rejects.toThrow('boom');

      expect(receivedCtor).toBe(FailingSeeder);
      expect(receivedError).toBe(boom);
    });

    it('does not call onAfter when a seeder throws', async () => {
      const onAfter = vi.fn();

      @Seeder()
      class ThrowingSeeder {
        async run(_ctx: SeedContext) {
          throw new Error('fail');
        }
      }

      await expect(runSeeders([ThrowingSeeder], { logging: false, onAfter })).rejects.toThrow();

      expect(onAfter).not.toHaveBeenCalled();
    });

    it('re-throws the error after onError completes', async () => {
      const boom = new Error('original');

      @Seeder()
      class RethrowSeeder {
        async run(_ctx: SeedContext) {
          throw boom;
        }
      }

      await expect(
        runSeeders([RethrowSeeder], {
          logging: false,
          onError: () => {},
        }),
      ).rejects.toBe(boom);
    });
  });

  describe('logging', () => {
    let loggingSource: DataSource;

    beforeAll(async () => {
      loggingSource = new DataSource({
        type: 'better-sqlite3',
        database: ':memory:',
        synchronize: true,
        logging: ['log', 'warn'],
        entities: [],
      });

      await loggingSource.initialize();
    });

    afterAll(async () => {
      if (loggingSource.isInitialized) {
        await loggingSource.destroy();
      }
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('logs a start and done message for each seeder by default', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      @Seeder()
      class LogDefaultSeeder {
        async run(_ctx: SeedContext) {}
      }

      await runSeeders([LogDefaultSeeder], {});

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[LogDefaultSeeder]'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Starting'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Done'));
    });

    it('logs a failure message to console.error when a seeder throws', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});

      @Seeder()
      class LogErrorSeeder {
        async run(_ctx: SeedContext) {
          throw new Error('oops');
        }
      }

      await expect(runSeeders([LogErrorSeeder], {})).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[LogErrorSeeder]'));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed'));
    });

    it('suppresses all console output when logging is false', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      @Seeder()
      class SilentSeeder {
        async run(_ctx: SeedContext) {}
      }

      await runSeeders([SilentSeeder], { logging: false });

      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('suppresses the failure message when logging is false', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      @Seeder()
      class SilentErrorSeeder {
        async run(_ctx: SeedContext) {
          throw new Error('silent');
        }
      }

      await expect(runSeeders([SilentErrorSeeder], { logging: false })).rejects.toThrow();

      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('routes logging through the TypeORM logger when a dataSource is provided', async () => {
      const loggerSpy = vi.spyOn(loggingSource.logger, 'log');

      @Seeder()
      class TypeOrmLogSeeder {
        async run(_ctx: SeedContext) {}
      }

      await runSeeders([TypeOrmLogSeeder], { dataSource: loggingSource });

      expect(loggerSpy).toHaveBeenCalledWith('log', expect.stringContaining('[TypeOrmLogSeeder]'));
      expect(loggerSpy).toHaveBeenCalledWith('log', expect.stringContaining('Starting'));
      expect(loggerSpy).toHaveBeenCalledWith('log', expect.stringContaining('Done'));
    });

    it('logs a failure at warn level through the TypeORM logger', async () => {
      const loggerSpy = vi.spyOn(loggingSource.logger, 'log');

      @Seeder()
      class TypeOrmWarnSeeder {
        async run(_ctx: SeedContext) {
          throw new Error('fail');
        }
      }

      await expect(
        runSeeders([TypeOrmWarnSeeder], { dataSource: loggingSource }),
      ).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('[TypeOrmWarnSeeder]'),
      );
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

    it('calls the TypeORM logger even when TypeORM logging is disabled — suppression happens internally', async () => {
      // dataSource has logging: false so TypeORM suppresses the output, but we still
      // call logger.log() — the documented behaviour is that seeder logging follows
      // TypeORM's own logging config, and console is never used when a dataSource is present.
      const loggerSpy = vi.spyOn(dataSource.logger, 'log');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      @Seeder()
      class TypeOrmDisabledLogSeeder {
        async run(_ctx: SeedContext) {}
      }

      await runSeeders([TypeOrmDisabledLogSeeder], { dataSource });

      expect(loggerSpy).toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('circular dependencies', () => {
    it('throws when a cycle is detected', async () => {
      class CycleA {
        async run(_ctx: SeedContext) {}
      }

      class CycleB {
        async run(_ctx: SeedContext) {}
      }

      registerSeeder(CycleA, { dependencies: [CycleB] });
      registerSeeder(CycleB, { dependencies: [CycleA] });

      await expect(runSeeders([CycleA], {})).rejects.toThrow('Circular dependency');
    });

    it('names the offending seeders in the error message', async () => {
      class LoopX {
        async run(_ctx: SeedContext) {}
      }

      class LoopY {
        async run(_ctx: SeedContext) {}
      }

      registerSeeder(LoopX, { dependencies: [LoopY] });
      registerSeeder(LoopY, { dependencies: [LoopX] });

      await expect(runSeeders([LoopX], {})).rejects.toThrow(/LoopX|LoopY/);
    });
  });
});
