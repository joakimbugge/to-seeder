import { runSeeders as baseRunSeeders } from '@joakimbugge/seeder';
import type {
  RunSeedersOptions as BaseRunSeedersOptions,
  SeederInterface,
} from '@joakimbugge/seeder';
import type { SeedContext } from '../seed/context.js';

/** Constructor type for a class decorated with `@Seeder`. */
export type SeederCtor = new () => SeederInterface;

/** Options for {@link runSeeders}. Extends the base options with TypeORM-specific logging. */
export type RunSeedersOptions = Omit<BaseRunSeedersOptions<SeedContext>, 'logging'> & {
  /**
   * - `'typeorm'` — delegates to the TypeORM logger on the provided `dataSource`. Output follows
   *   TypeORM's own `logging` configuration: if TypeORM logging is disabled, seeder output is
   *   suppressed too. Silently no-ops when no `dataSource` is available.
   */
  logging?: false | true | 'typeorm';
};

/**
 * Runs the given seeders (and all their transitive dependencies) in dependency order.
 *
 * @example
 * await runSeeders([PostSeeder], { dataSource })
 *
 * @example
 * // Delegate logging to TypeORM's own logger
 * await runSeeders([PostSeeder], { dataSource, logging: 'typeorm' })
 */
export function runSeeders(seeders: SeederCtor[], options: RunSeedersOptions = {}) {
  const { logging = false, ...rest } = options;

  // Make sure logging is a boolean. Resolve to a TypeORM logger later while also changing logging to `true`
  let resolvedLogging = logging === 'typeorm' ? false : logging;
  let resolvedLogger = rest.logger;

  if (logging === 'typeorm') {
    const { dataSource } = rest;

    if (dataSource) {
      resolvedLogging = true;
      resolvedLogger = {
        log: (msg) => dataSource.logger.log('log', msg),
        info: (msg) => dataSource.logger.log('info', msg),
        warn: (msg) => dataSource.logger.log('warn', msg),
        error: (msg) => dataSource.logger.log('warn', msg),
        debug: (msg) => dataSource.logger.log('log', msg),
      };
    }
  }

  return baseRunSeeders(seeders, {
    ...rest,
    logging: resolvedLogging,
    logger: resolvedLogger,
  });
}
