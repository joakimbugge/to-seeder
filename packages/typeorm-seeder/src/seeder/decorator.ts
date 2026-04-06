import { registerSeeder } from './registry.js';
import type { SeedContext } from '../seed/context.js';

/**
 * Interface that seeder classes must implement.
 *
 * The `run` method receives the seed context (which includes the DataSource when
 * called via `runSeeders`) and performs the seeding logic — typically by calling
 * `seed().save()` or other seeding utilities.
 */
export interface SeederInterface {
  run(context: SeedContext): Promise<unknown>;
}

/** Configuration options for the {@link Seeder} decorator. */
export interface SeederOptions {
  /**
   * Seeder classes that must complete before this one runs.
   * Resolved transitively — dependencies of dependencies are included automatically.
   * {@link runSeeders} topologically sorts the full set and detects circular dependencies.
   */
  dependencies?: (new () => SeederInterface)[];
}

/*** Marks a class as a seeder with no explicit dependency configuration.
 */
export function Seeder(): ClassDecorator;
/**
 * Marks a class as a seeder and registers dependency metadata.
 *
 * @example
 * @Seeder({ dependencies: [UserSeeder] })
 * class PostSeeder implements SeederInterface {
 *   async run(ctx: SeedContext) {
 *     await seed(Post).saveMany(50, ctx)
 *   }
 * }
 */
export function Seeder(options: SeederOptions): ClassDecorator;
/**
 * Shared implementation for both overloads.
 * Normalizes missing options to an empty dependency list.
 */
export function Seeder(options: SeederOptions = {}): ClassDecorator {
  return (target) => {
    registerSeeder(target, { dependencies: options.dependencies ?? [] });
  };
}
