import type { CreateOptions } from './creator.js';
import { create, createMany } from './creator.js';
import type { SaveManyOptions, SaveOptions } from './persist.js';
import { save, saveMany } from './persist.js';
import type {
  EntityConstructor,
  EntityInstance,
  MapToInstanceArrays,
  MapToInstances,
  SeedContext,
} from './registry.js';

export type { CreateOptions } from './creator.js';

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
 * Entry point for creating and persisting seed data.
 *
 * Pass a single entity class to get a {@link SingleSeed} builder, or an array of classes
 * to get a {@link MultiSeed} builder that operates on all of them at once.
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
 *
 * @example
 * // Create multiple entity classes at once (relations disabled by default)
 * const [user, post] = await seed([User, Post]).create()
 */
export function seed<T extends EntityInstance>(EntityClass: EntityConstructor<T>): SingleSeed<T>;
export function seed<T extends readonly EntityConstructor[]>(EntityClasses: [...T]): MultiSeed<T>;
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
