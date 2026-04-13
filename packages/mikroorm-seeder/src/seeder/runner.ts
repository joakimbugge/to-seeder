import { runSeeders as baseRunSeeders } from '@joakimbugge/seeder';
import type {
  RunSeedersOptions as BaseRunSeedersOptions,
  SeederInterface,
} from '@joakimbugge/seeder';
import type { SeedContext } from '../seed/context.js';

/** Constructor type for a class decorated with `@Seeder`. */
export type SeederCtor = new () => SeederInterface;

/** Options for {@link runSeeders}. Extends the base options with MikroORM-specific logging. */
export type RunSeedersOptions = Omit<BaseRunSeedersOptions<SeedContext>, 'logging'> & {
  /**
   * - `'mikroorm'` — delegates to the MikroORM logger on the provided `em`. Output follows
   *   MikroORM's own `debug` configuration: if MikroORM logging is disabled, seeder output is
   *   suppressed too. Silently no-ops when no `em` is available.
   */
  logging?: false | true | 'mikroorm';
};

/**
 * Runs the given seeders (and all their transitive dependencies) in dependency order.
 *
 * @example
 * await runSeeders([PostSeeder], { em })
 *
 * @example
 * // Delegate logging to MikroORM's own logger
 * await runSeeders([PostSeeder], { em, logging: 'mikroorm' })
 */
export function runSeeders(seeders: SeederCtor[], options: RunSeedersOptions = {}) {
  const { logging = false, ...rest } = options;

  // Make sure logging is a boolean. Resolve a MikroORM logger later, while also changing logging to `true`
  let resolvedLogging = logging === 'mikroorm' ? false : logging;
  let resolvedLogger = rest.logger;

  if (logging === 'mikroorm') {
    const { em } = rest;

    if (em) {
      const mikro = em.config.getLogger();
      resolvedLogging = true;
      resolvedLogger = {
        log: (msg) => mikro.log('info', msg),
        info: (msg) => mikro.log('info', msg),
        warn: (msg) => mikro.warn('info', msg),
        error: (msg) => mikro.warn('info', msg),
        debug: (msg) => mikro.log('info', msg),
      };
    }
  }

  return baseRunSeeders(seeders, {
    ...rest,
    logging: resolvedLogging,
    logger: resolvedLogger,
  });
}
