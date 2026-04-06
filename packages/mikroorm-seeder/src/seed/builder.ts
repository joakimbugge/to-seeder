import { makeSeedBuilder, makeMultiSeedBuilder } from '@joakimbugge/seeder';
import type { MultiSeed as BaseMultiSeed, SingleSeed as BaseSingleSeed } from '@joakimbugge/seeder';
import { mikroOrmAdapter, mikroOrmPersistenceAdapter } from './adapter.js';
import type { MikroOrmPersistContext } from './adapter.js';
import type { EntityConstructor, EntityInstance } from '@joakimbugge/seeder';

/**
 * Seed builder for a single entity class. Returned by {@link seed} when passed one class.
 * Narrows `TContext` to {@link MikroOrmPersistContext}, requiring `em` for persistence.
 */
export type SingleSeed<T extends EntityInstance> = BaseSingleSeed<T, MikroOrmPersistContext>;

/**
 * Seed builder for multiple entity classes. Returned by {@link seed} when passed an array.
 * Each method returns a tuple of instances in the same order as the input array.
 * Relation seeding is disabled by default; pass `relations: true` in the context to enable it.
 */
export type MultiSeed<T extends readonly EntityConstructor[]> = BaseMultiSeed<
  T,
  MikroOrmPersistContext
>;

/**
 * Returns a {@link SingleSeed} builder for the given entity class.
 *
 * @example
 * // Create one Director in memory (no DB)
 * const director = await seed(Director).create()
 *
 * @example
 * // Persist one Director with all its seeded relations
 * const director = await seed(Director).save({ em })
 *
 * @example
 * // Persist 10 Directors
 * const directors = await seed(Director).saveMany(10, { em })
 */
export function seed<T extends EntityInstance>(EntityClass: EntityConstructor<T>): SingleSeed<T>;
/**
 * Returns a {@link MultiSeed} builder for the given entity classes.
 * Relation seeding is disabled by default; pass `relations: true` in the context to enable it.
 *
 * @example
 * // Create multiple entity classes at once (relations disabled by default)
 * const [user, post] = await seed([User, Post]).create()
 */
export function seed<T extends readonly EntityConstructor[]>(EntityClasses: [...T]): MultiSeed<T>;
export function seed<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
): SingleSeed<T> | MultiSeed<readonly EntityConstructor[]> {
  if (Array.isArray(classOrClasses)) {
    const classes = classOrClasses as readonly EntityConstructor[];

    return makeMultiSeedBuilder(
      classes as [...typeof classes],
      mikroOrmAdapter,
      mikroOrmPersistenceAdapter,
    );
  }

  return makeSeedBuilder(
    classOrClasses as EntityConstructor<T>,
    mikroOrmAdapter,
    mikroOrmPersistenceAdapter,
  );
}
