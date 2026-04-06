import type { EntityManager } from '@mikro-orm/core';
import type { SeedContext as BaseSeedContext } from '@joakimbugge/seeder';

/** Context passed through a seed operation. Available inside factory callbacks and `SeederInterface.run`. */
export type SeedContext = BaseSeedContext & {
  /**
   * The MikroORM EntityManager. Automatically set by `save`/`saveMany` calls.
   * Also available in factory callbacks — useful for looking up existing entities.
   */
  em?: EntityManager;
};
