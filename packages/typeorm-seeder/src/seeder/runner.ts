import { DepGraph } from 'dependency-graph';
import { getSeederMeta } from './registry.js';
import type { SeederInterface } from './decorator.js';
import type { SeedContext } from '../seed/registry.js';

export type SeederCtor = new () => SeederInterface;

export interface RunSeedersOptions extends SeedContext {
  /**
   * Enable console logging for each seeder. Set to `false` to silence output,
   * e.g. when using callbacks to handle logging yourself.
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
}

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

export async function runSeeders(
  seeders: SeederCtor[],
  options: RunSeedersOptions = {},
): Promise<void> {
  const { logging = true, onBefore, onAfter, onError, ...context } = options;

  for (const SeederClass of topoSort(seeders)) {
    if (logging) {
      console.log(`[${SeederClass.name}] Starting...`);
    }

    await onBefore?.(SeederClass);

    const start = Date.now();

    try {
      await new SeederClass().run(context);
    } catch (err) {
      const durationMs = Date.now() - start;

      if (logging) {
        console.error(`[${SeederClass.name}] Failed after ${durationMs}ms`);
      }

      await onError?.(SeederClass, err);
      throw err;
    }

    const durationMs = Date.now() - start;

    if (logging) {
      console.log(`[${SeederClass.name}] Done in ${durationMs}ms`);
    }

    await onAfter?.(SeederClass, durationMs);
  }
}
