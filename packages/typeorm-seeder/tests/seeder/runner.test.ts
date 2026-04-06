import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Column, DataSource, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { SeedContext } from '../../src';
import { runSeeders, seed, Seed, Seeder } from '../../src';
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
          await seed(SeedUser).saveMany(3, { ...ctx, dataSource: ctx.dataSource! });
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

  describe('parallel execution', () => {
    it('runs independent seeders concurrently', async () => {
      const starts: number[] = [];
      const ends: number[] = [];

      const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

      @Seeder()
      class ParallelA {
        async run(_ctx: SeedContext) {
          starts.push(Date.now());
          await delay(50);
          ends.push(Date.now());
        }
      }

      @Seeder()
      class ParallelB {
        async run(_ctx: SeedContext) {
          starts.push(Date.now());
          await delay(50);
          ends.push(Date.now());
        }
      }

      const wallStart = Date.now();
      await runSeeders([ParallelA, ParallelB], { logging: false });
      const wallDuration = Date.now() - wallStart;

      // Both seeders started before either finished — they overlapped
      expect(starts).toHaveLength(2);
      expect(ends).toHaveLength(2);
      expect(Math.max(...starts)).toBeLessThan(Math.min(...ends));

      // Total wall time is closer to 50ms than to 100ms
      expect(wallDuration).toBeLessThan(90);
    });

    it('waits for all seeders in a level before starting the next level', async () => {
      const order: string[] = [];
      const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

      @Seeder()
      class DiamondA {
        async run(_ctx: SeedContext) {
          await delay(30);
          order.push('A');
        }
      }

      @Seeder()
      class DiamondB {
        async run(_ctx: SeedContext) {
          await delay(10);
          order.push('B');
        }
      }

      @Seeder({ dependencies: [DiamondA, DiamondB] })
      class DiamondC {
        async run(_ctx: SeedContext) {
          order.push('C');
        }
      }

      await runSeeders([DiamondC], { logging: false });

      // A and B run concurrently (B finishes first due to shorter delay), then C
      expect(order).toEqual(['B', 'A', 'C']);
    });
  });

  describe('return values', () => {
    it('returns a Map with the return value of each seeder', async () => {
      const users = [{ id: 1 }, { id: 2 }];

      @Seeder()
      class ReturnValueSeeder {
        async run(_ctx: SeedContext) {
          return users;
        }
      }

      const results = await runSeeders([ReturnValueSeeder], { logging: false });

      expect(results.get(ReturnValueSeeder)).toBe(users);
    });

    it('collects return values for all seeders in the suite', async () => {
      @Seeder()
      class ReturnA {
        async run(_ctx: SeedContext) {
          return 'a';
        }
      }

      @Seeder({ dependencies: [ReturnA] })
      class ReturnB {
        async run(_ctx: SeedContext) {
          return 'b';
        }
      }

      const results = await runSeeders([ReturnB], { logging: false });

      expect(results.get(ReturnA)).toBe('a');
      expect(results.get(ReturnB)).toBe('b');
    });

    it('does not include skipped seeders in the results', async () => {
      @Seeder()
      class SkippedReturnSeeder {
        async run(_ctx: SeedContext) {
          return 'should not appear';
        }
      }

      const results = await runSeeders([SkippedReturnSeeder], {
        logging: false,
        skip: () => true,
      });

      expect(results.has(SkippedReturnSeeder)).toBe(false);
    });
  });
});
