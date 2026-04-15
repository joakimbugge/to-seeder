import { DepGraph } from 'dependency-graph';
import { getSeederMeta } from './registry.js';
import { ConsoleLogger } from './logger.js';
import type { SeederLogger } from './logger.js';
import type { SeederInterface } from './decorator.js';
import type { SeedContext } from '../seed/registry.js';
import type { SeederRunContext } from './context.js';

/** Constructor type for a class decorated with `@Seeder`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SeederCtor<TResult = unknown> = new () => SeederInterface<any, TResult>;

/**
 * Typed result map returned by {@link runSeeders}.
 *
 * The `get` overload infers the return type from the seeder constructor, so no casting is needed:
 *
 * @example
 * const results = await runSeeders([UserSeeder, PostSeeder]);
 * const users = results.get(UserSeeder); // User[]
 * const posts = results.get(PostSeeder); // Post[]
 */
export interface SeederResultMap extends Omit<ReadonlyMap<SeederCtor, unknown>, 'get'> {
  get<TResult>(key: SeederCtor<TResult>): TResult | undefined;
}

/** Options for {@link runSeeders}. Extends {@link SeedContext} with lifecycle hooks and logging control. */
export type RunSeedersOptions<TContext extends SeedContext = SeedContext> = TContext & {
  /**
   * Controls seeder progress output.
   *
   * - `false` (default) — no output.
   * - `true` — logs via {@link ConsoleLogger} (or a custom {@link SeederLogger} if {@link logger} is provided).
   *
   * ORM packages extend this with their own logging key (e.g. `'typeorm'`, `'mikroorm'`).
   *
   * @default false
   */
  logging?: false | true;
  /**
   * Custom logger used when `logging` is `true`. Ignored when `logging` is `false`.
   * Defaults to {@link ConsoleLogger} when omitted.
   */
  logger?: SeederLogger;
  /** Called once before any seeder runs. */
  onBefore?: () => void | Promise<void>;
  /**
   * Called once after all seeders complete successfully.
   * Receives the list of seeders that ran (excluding skipped ones) and the total duration.
   */
  onSuccess?: (seeders: SeederCtor[], durationMs: number) => void | Promise<void>;
  /** Called when a seeder throws, with the failing seeder and the error. The error is re-thrown after this returns. */
  onError?: (seeder: SeederCtor, error: unknown) => void | Promise<void>;
  /** Always called once after all seeders finish — whether all succeeded or one threw. */
  onFinally?: (durationMs: number) => void | Promise<void>;
  /** Called for each seeder before it runs. Return `true` to skip it entirely. */
  skip?: (seeder: SeederCtor) => boolean | Promise<boolean>;
};

/**
 * Groups seeders into parallel execution levels.
 *
 * BFS collects all nodes transitively, dependency edges are wired, and each node is
 * assigned the level `max(dep levels) + 1` (or `0` for roots). Nodes at the same level
 * have no dependency on each other and can run concurrently. Levels are returned in
 * ascending order so every dependency completes before the seeders that need it start.
 * Throws a descriptive error if a circular dependency is detected.
 */
function buildLevels(roots: SeederCtor[]) {
  const graph = new DepGraph<SeederCtor>();
  const byName = new Map<string, SeederCtor>();

  const visited = new Set<SeederCtor>();
  const queue = [...roots];

  while (queue.length > 0) {
    const node = queue.shift()!;

    if (visited.has(node)) {
      continue;
    }

    visited.add(node);
    graph.addNode(node.name, node);
    byName.set(node.name, node);

    for (const dep of (getSeederMeta(node)?.dependencies ?? []) as SeederCtor[]) {
      queue.push(dep);
    }
  }

  for (const node of visited) {
    for (const dep of (getSeederMeta(node)?.dependencies ?? []) as SeederCtor[]) {
      graph.addDependency(node.name, dep.name);
    }
  }

  let ordered: string[];

  try {
    ordered = graph.overallOrder();
  } catch (err) {
    if (err && typeof err === 'object' && 'cyclePath' in err) {
      const path = (err as { cyclePath: string[] }).cyclePath.join(' → ');
      throw new Error(`Circular dependency detected among seeders: ${path}`);
    }

    throw err;
  }

  const levels: SeederCtor[][] = [];
  const levelOf = new Map<string, number>();

  for (const name of ordered) {
    const deps = graph.directDependenciesOf(name);
    const level = deps.length === 0 ? 0 : Math.max(...deps.map((d) => levelOf.get(d)!)) + 1;

    levelOf.set(name, level);
    (levels[level] ??= []).push(byName.get(name)!);
  }

  return levels;
}

function resolveLog(logging: false | true, logger: SeederLogger | undefined) {
  if (!logging) {
    return null;
  }

  const log = logger ?? new ConsoleLogger();

  return {
    progress: (msg: string) => log.log(msg),
    failure: (msg: string) => log.warn(msg),
  };
}

/**
 * Runs the given seeders (and all their transitive dependencies) in dependency order.
 *
 * Each seeder is instantiated and its `run` method is called with the context derived
 * from `options`. Lifecycle hooks fire at two levels:
 *
 * - **Class-level** (`onBefore`, `onSuccess`, `onError`, `onFinally` methods on the seeder
 *   instance) — per-seeder logic defined directly inside the class.
 * - **`runSeeders`-level** (`onBefore`, `onSuccess`, `onError`, `onFinally` in options) —
 *   global hooks that fire once for the entire run.
 *
 * Class-level hooks fire first. Errors are re-thrown after `onError` and `onFinally` return.
 *
 * @example
 * await runSeeders([PostSeeder], { dataSource })
 *
 * @example
 * // With console logging and a custom logger
 * await runSeeders([PostSeeder], {
 *   logging: true,
 *   logger: myLogger,
 * })
 */
export async function runSeeders(seeders: SeederCtor[], options: RunSeedersOptions = {}) {
  const {
    logging = false,
    logger,
    onBefore,
    onSuccess,
    onError,
    onFinally,
    skip,
    ...context
  } = options;
  const results = new Map<SeederCtor, unknown>();
  const log = resolveLog(logging, logger);

  // Build SeederRunContext by adding the live results map to the base context.
  // Each seeder's run() method and any @Seed factory callbacks (when ctx is spread
  // into createMany/saveMany options) can read previously completed seeders' results.
  const ctx: SeederRunContext = { ...context, results };

  await onBefore?.();

  const start = Date.now();
  let failingSeeder: SeederCtor | undefined;

  try {
    for (const level of buildLevels(seeders)) {
      await Promise.all(
        level.map(async (SeederClass) => {
          if (await skip?.(SeederClass)) {
            return;
          }

          const instance = new SeederClass();

          log?.progress(`[${SeederClass.name}] Starting...`);
          await instance.onBefore?.();

          const seederStart = Date.now();

          try {
            results.set(SeederClass, await instance.run(ctx));
          } catch (err) {
            failingSeeder = SeederClass;
            const seederDuration = Date.now() - seederStart;
            log?.failure(`[${SeederClass.name}] Failed after ${seederDuration}ms`);
            await instance.onError?.(err);
            await instance.onFinally?.(seederDuration);
            throw err;
          }

          const seederDuration = Date.now() - seederStart;
          log?.progress(`[${SeederClass.name}] Done in ${seederDuration}ms`);
          await instance.onSuccess?.(seederDuration);
          await instance.onFinally?.(seederDuration);
        }),
      );
    }
  } catch (err) {
    const totalDuration = Date.now() - start;
    await onError?.(failingSeeder!, err);
    await onFinally?.(totalDuration);
    throw err;
  }

  const totalDuration = Date.now() - start;
  await onSuccess?.([...results.keys()], totalDuration);
  await onFinally?.(totalDuration);

  return results as SeederResultMap;
}
