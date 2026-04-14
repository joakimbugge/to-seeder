import { registerSeeder } from './registry.js';
import type { SeedContext } from '../seed/registry.js';
import type { SeederRunContext } from './context.js';

/**
 * Interface that seeder classes must implement.
 *
 * - `TContext` — lets ORM packages expose a narrowed version whose `run` method receives the
 *   ORM-specific context (e.g. `dataSource`, `em`). Defaults to {@link SeederRunContext}.
 * - `TResult` — the value returned by `run`. Inferred by {@link runSeeders} so that
 *   `results.get(MySeeder)` resolves to the correct type without casting.
 */
export interface SeederInterface<
  TContext extends SeedContext = SeederRunContext,
  TResult = unknown,
> {
  run(context: TContext): Promise<TResult>;
}

/** Configuration options for the {@link Seeder} decorator. */
export interface SeederOptions<TContext extends SeedContext = SeederRunContext> {
  /**
   * Seeder classes that must complete before this one runs.
   * Resolved transitively — dependencies of dependencies are included automatically.
   * {@link runSeeders} topologically sorts the full set and detects circular dependencies.
   */
  dependencies?: (new () => SeederInterface<TContext, any>)[];
}

/** Marks a class as a seeder with no explicit dependency configuration. */
export function Seeder(): ClassDecorator;

/**
 * Marks a class as a seeder and registers dependency metadata.
 *
 * @example
 * @Seeder({ dependencies: [UserSeeder] })
 * class PostSeeder implements SeederInterface {
 *   async run(ctx: SeederRunContext) {
 *     await seed(Post).saveMany(50, ctx)
 *   }
 * }
 */
export function Seeder<TContext extends SeedContext = SeederRunContext>(
  options: SeederOptions<TContext>,
): ClassDecorator;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Seeder(options: SeederOptions<any> = {}): ClassDecorator {
  return (target) => {
    registerSeeder(target, { dependencies: options.dependencies ?? [] });
  };
}
