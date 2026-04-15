import { describe, expect, it, vi } from 'vitest';
import type { SeedContext, SeederRunContext } from '../../src';
import { runSeeders, Seeder } from '../../src';
import type { SeederCtor } from '../../src';

describe('seeder suites', () => {
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

    it('does not call onSuccess with skipped seeders and does not invoke class-level hooks', async () => {
      let receivedSeeders: SeederCtor[] | undefined;

      @Seeder()
      class SkipHookSeeder {
        onBefore() {
          throw new Error('should not be called');
        }

        async run(_ctx: SeedContext) {}
      }

      await runSeeders([SkipHookSeeder], {
        logging: false,
        skip: () => true,
        onSuccess: (seeders) => {
          receivedSeeders = seeders;
        },
      });

      expect(receivedSeeders).toEqual([]);
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

      await runSeeders([StandaloneSeeder], {});

      expect(spy).toHaveBeenCalledOnce();
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

      await runSeeders([DepB], {});

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

      await runSeeders([TransC], {});

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

      await runSeeders([SharedDep, DependsOnShared], {});

      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe('hooks', () => {
    it('calls onBefore once before any seeder runs', async () => {
      const events: string[] = [];

      @Seeder()
      class HookBeforeA {
        async run(_ctx: SeedContext) {
          events.push('run:A');
        }
      }

      @Seeder({ dependencies: [HookBeforeA] })
      class HookBeforeB {
        async run(_ctx: SeedContext) {
          events.push('run:B');
        }
      }

      await runSeeders([HookBeforeB], {
        logging: false,
        onBefore: () => {
          events.push('before');
        },
      });

      expect(events).toEqual(['before', 'run:A', 'run:B']);
    });

    it('calls onSuccess with all ran seeders and total duration after all complete', async () => {
      let receivedSeeders: SeederCtor[] | undefined;
      let receivedDuration: number | undefined;

      @Seeder()
      class HookSuccessA {
        async run(_ctx: SeedContext) {}
      }

      @Seeder({ dependencies: [HookSuccessA] })
      class HookSuccessB {
        async run(_ctx: SeedContext) {}
      }

      await runSeeders([HookSuccessB], {
        logging: false,
        onSuccess: (seeders, durationMs) => {
          receivedSeeders = seeders;
          receivedDuration = durationMs;
        },
      });

      expect(receivedSeeders).toEqual([HookSuccessA, HookSuccessB]);
      expect(receivedDuration).toBeGreaterThanOrEqual(0);
    });

    it('fires onBefore then all seeders then onSuccess', async () => {
      const events: string[] = [];

      @Seeder()
      class GlobalOrderSeeder {
        async run(_ctx: SeedContext) {
          events.push('run');
        }
      }

      await runSeeders([GlobalOrderSeeder], {
        logging: false,
        onBefore: () => {
          events.push('before');
        },
        onSuccess: () => {
          events.push('success');
        },
      });

      expect(events).toEqual(['before', 'run', 'success']);
    });

    it('calls onError with the failing seeder and the thrown error', async () => {
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

    it('does not call onSuccess when a seeder throws', async () => {
      const onSuccess = vi.fn();

      @Seeder()
      class ThrowingSeeder {
        async run(_ctx: SeedContext) {
          throw new Error('fail');
        }
      }

      await expect(runSeeders([ThrowingSeeder], { logging: false, onSuccess })).rejects.toThrow();

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('calls onFinally on success with total duration', async () => {
      let receivedDuration: number | undefined;

      @Seeder()
      class FinallySuccessSeeder {
        async run(_ctx: SeedContext) {}
      }

      await runSeeders([FinallySuccessSeeder], {
        logging: false,
        onFinally: (durationMs) => {
          receivedDuration = durationMs;
        },
      });

      expect(receivedDuration).toBeGreaterThanOrEqual(0);
    });

    it('calls onFinally on error with total duration', async () => {
      let receivedDuration: number | undefined;

      @Seeder()
      class FinallyErrorSeeder {
        async run(_ctx: SeedContext) {
          throw new Error('fail');
        }
      }

      await expect(
        runSeeders([FinallyErrorSeeder], {
          logging: false,
          onFinally: (durationMs) => {
            receivedDuration = durationMs;
          },
        }),
      ).rejects.toThrow();

      expect(receivedDuration).toBeGreaterThanOrEqual(0);
    });

    it('does not call onFinally when onBefore throws', async () => {
      const onFinally = vi.fn();

      @Seeder()
      class AnySeeder {
        async run(_ctx: SeedContext) {}
      }

      await expect(
        runSeeders([AnySeeder], {
          logging: false,
          onBefore: () => {
            throw new Error('before failed');
          },
          onFinally,
        }),
      ).rejects.toThrow('before failed');

      expect(onFinally).not.toHaveBeenCalled();
    });

    it('re-throws the error after onError and onFinally complete', async () => {
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
          onFinally: () => {},
        }),
      ).rejects.toBe(boom);
    });

    describe('class-level hooks', () => {
      it('calls instance onBefore before run()', async () => {
        const events: string[] = [];

        @Seeder()
        class ClassHookBeforeSeeder {
          onBefore() {
            events.push('onBefore');
          }

          async run(_ctx: SeedContext) {
            events.push('run');
          }
        }

        await runSeeders([ClassHookBeforeSeeder], { logging: false });

        expect(events).toEqual(['onBefore', 'run']);
      });

      it('calls instance onSuccess with duration after run() succeeds', async () => {
        let receivedDuration: number | undefined;

        @Seeder()
        class ClassHookSuccessSeeder {
          onSuccess(durationMs: number) {
            receivedDuration = durationMs;
          }

          async run(_ctx: SeedContext) {}
        }

        await runSeeders([ClassHookSuccessSeeder], { logging: false });

        expect(receivedDuration).toBeGreaterThanOrEqual(0);
      });

      it('calls instance onError with the thrown error', async () => {
        const boom = new Error('boom');
        let receivedError: unknown;

        @Seeder()
        class ClassHookErrorSeeder {
          onError(error: unknown) {
            receivedError = error;
          }

          async run(_ctx: SeedContext) {
            throw boom;
          }
        }

        await expect(runSeeders([ClassHookErrorSeeder], { logging: false })).rejects.toThrow(
          'boom',
        );

        expect(receivedError).toBe(boom);
      });

      it('calls instance onFinally on success and on error', async () => {
        let successCalled = false;
        let errorCalled = false;

        @Seeder()
        class ClassFinallySuccessSeeder {
          onFinally() {
            successCalled = true;
          }

          async run(_ctx: SeedContext) {}
        }

        @Seeder()
        class ClassFinallyErrorSeeder {
          onFinally() {
            errorCalled = true;
          }

          async run(_ctx: SeedContext) {
            throw new Error('fail');
          }
        }

        await runSeeders([ClassFinallySuccessSeeder], { logging: false });
        await expect(runSeeders([ClassFinallyErrorSeeder], { logging: false })).rejects.toThrow();

        expect(successCalled).toBe(true);
        expect(errorCalled).toBe(true);
      });

      it('fires class-level hooks before runSeeders-level hooks', async () => {
        const events: string[] = [];

        @Seeder()
        class HookOrderSeeder {
          onBefore() {
            events.push('class:onBefore');
          }

          async run(_ctx: SeedContext) {
            events.push('run');
          }

          onSuccess() {
            events.push('class:onSuccess');
          }

          onFinally() {
            events.push('class:onFinally');
          }
        }

        await runSeeders([HookOrderSeeder], {
          logging: false,
          onSuccess: () => {
            events.push('runner:onSuccess');
          },
          onFinally: () => {
            events.push('runner:onFinally');
          },
        });

        expect(events).toEqual([
          'class:onBefore',
          'run',
          'class:onSuccess',
          'class:onFinally',
          'runner:onSuccess',
          'runner:onFinally',
        ]);
      });
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

  describe('results context', () => {
    it('exposes an empty results map to root seeders', async () => {
      let sizeAtCallTime: number | undefined;

      @Seeder()
      class RootSeeder {
        async run(ctx: SeederRunContext) {
          sizeAtCallTime = ctx.results?.size;
        }
      }

      await runSeeders([RootSeeder], {});

      expect(sizeAtCallTime).toBe(0);
    });

    it('exposes the dependency return value via ctx.results when a dependent seeder runs', async () => {
      const users = [{ id: 1 }, { id: 2 }];
      let receivedInDependent: unknown;

      @Seeder()
      class ResultsDepA {
        async run(_ctx: SeederRunContext) {
          return users;
        }
      }

      @Seeder({ dependencies: [ResultsDepA] })
      class ResultsDepB {
        async run(ctx: SeederRunContext) {
          receivedInDependent = ctx.results?.get(ResultsDepA);
        }
      }

      await runSeeders([ResultsDepB], {});

      expect(receivedInDependent).toBe(users);
    });

    it('ctx.results is the same Map instance returned by runSeeders', async () => {
      let ctxResults: ReadonlyMap<Function, unknown> | undefined;

      @Seeder()
      class SameMapSeeder {
        async run(ctx: SeederRunContext) {
          ctxResults = ctx.results;
        }
      }

      const returned = await runSeeders([SameMapSeeder], {});

      expect(ctxResults).toBe(returned);
    });

    it('accumulates results across a chain so each level sees all prior results', async () => {
      const snapshots: unknown[][] = [];

      @Seeder()
      class ChainA {
        async run(_ctx: SeederRunContext) {
          return 'a';
        }
      }

      @Seeder({ dependencies: [ChainA] })
      class ChainB {
        async run(ctx: SeederRunContext) {
          snapshots.push([...ctx.results!.values()]);
          return 'b';
        }
      }

      @Seeder({ dependencies: [ChainB] })
      class ChainC {
        async run(ctx: SeederRunContext) {
          snapshots.push([...ctx.results!.values()]);
          return 'c';
        }
      }

      await runSeeders([ChainC], {});

      // ChainB sees only A's result; ChainC sees A and B's results
      expect(snapshots[0]).toEqual(['a']);
      expect(snapshots[1]).toEqual(['a', 'b']);
    });
  });
});
