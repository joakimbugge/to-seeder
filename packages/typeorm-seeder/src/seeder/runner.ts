import { DepGraph } from 'dependency-graph';
import { getSeederMeta } from './registry.js';
import type { SeederInterface } from './decorator.js';
import type { SeedContext } from '../seed/registry.js';

/** Constructor type for a class decorated with `@Seeder`. */
export type SeederCtor = new () => SeederInterface;

/** Options for {@link runSeeders}. Extends {@link SeedContext} with lifecycle hooks and logging control. */
export interface RunSeedersOptions extends SeedContext {
  /**
   * Enable logging for each seeder. Set to `false` to silence output entirely,
   * e.g. when handling output yourself via hooks.
   *
   * When a `dataSource` is provided, logging is routed through TypeORM's own logger
   * so that seeder output follows the same `logging` configuration as the rest of
   * your TypeORM setup. If TypeORM logging is disabled (or does not include the
   * `"log"` level), seeder output will be suppressed even when this is `true`.
   * Falls back to `console` when no `dataSource` is available.
   *
   * @default true
   */
  logging?: boolean;
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
 * Topologically sorts the given seeders and all their transitive dependencies.
 * BFS walks from the roots to collect all nodes, then dependency edges are wired and
 * the graph is sorted so that every dependency precedes the seeders that depend on it.
 * Throws a descriptive error if a circular dependency is detected.
 */
function topoSort(roots: SeederCtor[]): SeederCtor[] {
  const graph = new DepGraph<SeederCtor>();
  const byName = new Map<string, SeederCtor>();

  // Collect all nodes transitively via BFS and register them in the graph.
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

  // Wire up the dependency edges.
  for (const node of visited) {
    for (const dep of (getSeederMeta(node)?.dependencies ?? []) as SeederCtor[]) {
      graph.addDependency(node.name, dep.name);
    }
  }

  try {
    return graph.overallOrder().map((name) => byName.get(name)!);
  } catch (err) {
    if (err && typeof err === 'object' && 'cyclePath' in err) {
      const path = (err as { cyclePath: string[] }).cyclePath.join(' → ');
      throw new Error(`Circular dependency detected among seeders: ${path}`);
    }

    throw err;
  }
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
 * // With lifecycle hooks and no console output
 * await runSeeders([PostSeeder], {
 *   dataSource,
 *   logging: false,
 *   onAfter: (seeder, ms) => console.log(`${seeder.name} done in ${ms}ms`),
 * })
 */
function logMessage(level: 'log' | 'warn', message: string, context: SeedContext): void {
  if (context.dataSource) {
    context.dataSource.logger.log(level, message);
  } else if (level === 'warn') {
    console.error(message);
  } else {
    console.log(message);
  }
}

export async function runSeeders(
  seeders: SeederCtor[],
  options: RunSeedersOptions = {},
): Promise<void> {
  const { logging = true, onBefore, onAfter, onError, skip, ...context } = options;

  for (const SeederClass of topoSort(seeders)) {
    if (await skip?.(SeederClass)) {
      continue;
    }

    if (logging) {
      logMessage('log', `[${SeederClass.name}] Starting...`, context);
    }

    await onBefore?.(SeederClass);

    const start = Date.now();

    try {
      await new SeederClass().run(context);
    } catch (err) {
      const durationMs = Date.now() - start;

      if (logging) {
        logMessage('warn', `[${SeederClass.name}] Failed after ${durationMs}ms`, context);
      }

      await onError?.(SeederClass, err);
      throw err;
    }

    const durationMs = Date.now() - start;

    if (logging) {
      logMessage('log', `[${SeederClass.name}] Done in ${durationMs}ms`, context);
    }

    await onAfter?.(SeederClass, durationMs);
  }
}
