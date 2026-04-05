import type { CreateOptions } from './creators/create.js';
import { create } from './creators/create.js';
import { createMany } from './creators/createMany.js';
import type { SaveManyOptions } from './persist/saveMany.js';
import type { SaveOptions } from './persist/save.js';
import { save } from './persist/save.js';
import { saveMany } from './persist/saveMany.js';
import type {
  EntityConstructor,
  EntityInstance,
  MapToInstanceArrays,
  MapToInstances,
  SeedContext,
} from './registry.js';

export type { CreateOptions } from './creators/create.js';

/** Seed builder for a single entity class. Returned by {@link seed} when passed one class. */
export interface SingleSeed<T extends EntityInstance> {
  /** Creates a single instance in memory without persisting. */
  create(context?: CreateOptions<T>): Promise<T>;
  /** Creates and persists a single instance. */
  save(options: SaveOptions<T>): Promise<T>;
  /** Creates multiple instances in memory without persisting. */
  createMany(count: number, context?: CreateOptions<T>): Promise<T[]>;
  /** Creates and persists multiple instances. */
  saveMany(count: number, options: SaveOptions<T>): Promise<T[]>;
}

/**
 * Seed builder for multiple entity classes. Returned by {@link seed} when passed an array.
 * Each method returns a tuple of instances in the same order as the input array.
 * Relation seeding is disabled by default; pass `relations: true` in the context to enable it.
 */
export interface MultiSeed<T extends readonly EntityConstructor[]> {
  /** Creates one instance of each class in memory without persisting. */
  create(context?: SeedContext): Promise<MapToInstances<T>>;
  /** Creates and persists one instance of each class. */
  save(options: SaveOptions): Promise<MapToInstances<T>>;
  /** Creates `count` instances of each class in memory without persisting. */
  createMany(count: number, context?: SeedContext): Promise<MapToInstanceArrays<T>>;
  /** Creates and persists `count` instances of each class. */
  saveMany(count: number, options: SaveOptions): Promise<MapToInstanceArrays<T>>;
}

/**
 * Returns a {@link SingleSeed} builder for the given entity class.
 *
 * @example
 * // Create one Author in memory (no DB)
 * const author = await seed(Author).create()
 *
 * @example
 * // Persist one Author with all its seeded relations
 * const author = await seed(Author).save({ dataSource })
 *
 * @example
 * // Persist 10 Authors
 * const authors = await seed(Author).saveMany(10, { dataSource })
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
/**
 * Shared implementation for both overloads.
 * Dispatches on `Array.isArray(classOrClasses)` to return the appropriate builder type.
 */
export function seed<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
): SingleSeed<T> | MultiSeed<readonly EntityConstructor[]> {
  if (Array.isArray(classOrClasses)) {
    const classes = classOrClasses as readonly EntityConstructor[];

    return {
      create: (context?: SeedContext) =>
        create(classes as [...typeof classes], context) as Promise<MapToInstances<typeof classes>>,
      save: (options: SaveOptions) =>
        save(classes as [...typeof classes], options) as Promise<MapToInstances<typeof classes>>,
      createMany: (count: number, context?: SeedContext) =>
        createMany(classes as [...typeof classes], { count, ...context }) as Promise<
          MapToInstanceArrays<typeof classes>
        >,
      saveMany: (count: number, options: SaveOptions) =>
        saveMany(
          classes as [...typeof classes],
          { count, ...options } as SaveManyOptions,
        ) as Promise<MapToInstanceArrays<typeof classes>>,
    };
  }

  const EntityClass = classOrClasses as EntityConstructor<T>;

  return {
    create: (options?: CreateOptions<T>) => create(EntityClass, options),
    save: (options: SaveOptions<T>) => save(EntityClass, options),
    createMany: (count: number, options?: CreateOptions<T>) =>
      createMany(EntityClass, { count, ...options }),
    saveMany: (count: number, options: SaveOptions<T>) =>
      saveMany(EntityClass, { count, ...options }),
  };
}
