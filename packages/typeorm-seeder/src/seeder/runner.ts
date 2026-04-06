import { DepGraph } from 'dependency-graph';
import { getSeederMeta } from './registry.js';
import { ConsoleLogger } from './logger.js';
import type { SeederLogger } from './logger.js';
import type { SeederInterface } from './decorator.js';
import type { SeedContext } from '../seed/context.js';

/** Constructor type for a class decorated with `@Seeder`. */
export type SeederCtor = new () => SeederInterface;

/** Options for {@link runSeeders}. Extends {@link SeedContext} with lifecycle hooks and logging control. */
export interface RunSeedersOptions extends SeedContext {
  /**
   * Controls seeder progress output.
   *
   * - `false` (default) — no output.
   * - `true` — logs via {@link ConsoleLogger} (or a custom {@link SeederLogger} if {@link logger} is provided).
   * - `'typeorm'` — delegates to the TypeORM logger on the provided `dataSource`. Output follows
   *   TypeORM's own `logging` configuration: if TypeORM logging is disabled, seeder output is
   *   suppressed too. Silently no-ops when no `dataSource` is available.
   *
   * @default false
   */
  logging?: false | true | 'typeorm';
  /**
   * Custom logger used when `logging` is `true`. Ignored for other `logging` values.
   * Defaults to {@link ConsoleLogger} when omitted.
   */
  logger?: SeederLogger;
  /** Called before each seeder runs, in execution order. */
  onBefore?: (seeder: SeederCtor) => void | Promise<void>;
  /** Called after each seeder completes successfully, with the time it took in milliseconds. */
  onAfter?: (seeder: SeederCtor, durationMs: number) => void | Promise<void>;
  /** Called when a seeder throws. The error is re-thrown after this callback returns. */
  onError?: (seeder: SeederCtor, error: unknown) => void | Promise<void>;
  /** Called for each seeder before it runs. Return `true` to skip it entirely. */
  skip?: (seeder: SeederCtor) => boolean | Promise<boolean>;
}

/**
 * Groups seeders into parallel execution levels.
 *
 * BFS collects all nodes transitively, dependency edges are wired, and each node is
 * assigned the level `max(dep levels) + 1` (or `0` for roots). Nodes at the same level
 * have no dependency on each other and can run concurrently. Levels are returned in
 * ascending order so every dependency completes before the seeders that need it start.
 * Throws a descriptive error if a circular dependency is detected.
 */
function buildLevels(roots: SeederCtor[]): SeederCtor[][] {
  const graph = new DepGraph<SeederCtor>();
  const byName = new Map<string, SeederCtor>();

  const visited = new Set<SeederCtor>();
  const queue: SeederCtor[] = [...roots];

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

/**
 * Resolves the active log helpers for a run, or returns `null` when logging is disabled.
 * - `false` → `null`
 * - `'typeorm'` → routes through `dataSource.logger`; `null` when no dataSource
 * - `true` → routes through the provided `SeederLogger` (defaults to {@link ConsoleLogger})
 */
function resolveLog(
  logging: false | true | 'typeorm',
  logger: SeederLogger | undefined,
  context: SeedContext,
): { progress(msg: string): void; failure(msg: string): void } | null {
  if (!logging) {
    return null;
  }

  if (logging === 'typeorm') {
    const { dataSource } = context;

    if (!dataSource) {
      return null;
    }

    return {
      progress: (msg) => dataSource.logger.log('log', msg),
      failure: (msg) => dataSource.logger.log('warn', msg),
    };
  }

  const log = logger ?? new ConsoleLogger();

  return {
    progress: (msg) => log.log(msg),
    failure: (msg) => log.warn(msg),
  };
}

/**
 * Runs the given seeders (and all their transitive dependencies) in dependency order.
 *
 * Each seeder is instantiated, its `run` method is called with the context derived
 * from `options`, and lifecycle hooks (`onBefore`, `onAfter`, `onError`) are called
 * around it. Errors are re-thrown after `onError` returns.
 *
 * @example
 * await runSeeders([PostSeeder], { dataSource })
 *
 * @example
 * // With console logging and a custom logger
 * await runSeeders([PostSeeder], {
 *   dataSource,
 *   logging: true,
 *   logger: myLogger,
 * })
 */
export async function runSeeders(
  seeders: SeederCtor[],
  options: RunSeedersOptions = {},
): Promise<Map<SeederCtor, unknown>> {
  const { logging = false, logger, onBefore, onAfter, onError, skip, ...context } = options;
  const results = new Map<SeederCtor, unknown>();
  const log = resolveLog(logging, logger, context);

  for (const level of buildLevels(seeders)) {
    await Promise.all(
      level.map(async (SeederClass) => {
        if (await skip?.(SeederClass)) {
          return;
        }

        log?.progress(`[${SeederClass.name}] Starting...`);
        await onBefore?.(SeederClass);

        const start = Date.now();

        try {
          results.set(SeederClass, await new SeederClass().run(context));
        } catch (err) {
          const durationMs = Date.now() - start;

          log?.failure(`[${SeederClass.name}] Failed after ${durationMs}ms`);
          await onError?.(SeederClass, err);
          throw err;
        }

        const durationMs = Date.now() - start;

        log?.progress(`[${SeederClass.name}] Done in ${durationMs}ms`);
        await onAfter?.(SeederClass, durationMs);
      }),
    );
  }

  return results;
}
