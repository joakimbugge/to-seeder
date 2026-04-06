import type { MetadataAdapter, PersistenceAdapter } from './adapter.js';
import type { CreateOptions, SeedValues } from './creators/create.js';
import { create } from './creators/create.js';
import type { CreateManyOptions } from './creators/createMany.js';
import { createMany } from './creators/createMany.js';
import { save } from './persist/save.js';
import { saveMany } from './persist/saveMany.js';
import type {
  EntityConstructor,
  EntityInstance,
  MapToInstanceArrays,
  MapToInstances,
  SeedContext,
} from './registry.js';

/**
 * Seed builder for a single entity class.
 * Returned by ORM `seed()` functions when passed one class.
 *
 * `TContext` is the ORM-specific context type that carries the connection required for
 * persistence (e.g. `{ dataSource: DataSource }` for TypeORM).
 */
export interface SingleSeed<T extends EntityInstance, TContext extends SeedContext = SeedContext> {
  /** Creates a single instance in memory without persisting. */
  create(options?: CreateOptions<T>): Promise<T>;
  /** Creates multiple instances in memory without persisting. */
  createMany(count: number, options?: CreateOptions<T>): Promise<T[]>;
  /** Creates and persists a single instance. */
  save(options: TContext & { values?: SeedValues<T> }): Promise<T>;
  /** Creates and persists multiple instances. */
  saveMany(count: number, options: TContext & { values?: SeedValues<T> }): Promise<T[]>;
}

/**
 * Seed builder for multiple entity classes.
 * Returned by ORM `seed()` functions when passed an array.
 * Each method returns a tuple of instances in the same order as the input array.
 * Relation seeding is disabled by default; pass `relations: true` in the context to enable it.
 *
 * `TContext` is the ORM-specific context type that carries the connection required for
 * persistence (e.g. `{ dataSource: DataSource }` for TypeORM).
 */
export interface MultiSeed<
  T extends readonly EntityConstructor[],
  TContext extends SeedContext = SeedContext,
> {
  /** Creates one instance of each class in memory without persisting. */
  create(context?: SeedContext): Promise<MapToInstances<T>>;
  /** Creates `count` instances of each class in memory without persisting. */
  createMany(count: number, context?: SeedContext): Promise<MapToInstanceArrays<T>>;
  /** Creates and persists one instance of each class. */
  save(options: TContext): Promise<MapToInstances<T>>;
  /** Creates and persists `count` instances of each class. */
  saveMany(count: number, options: TContext): Promise<MapToInstanceArrays<T>>;
}

/**
 * Returns a {@link SingleSeed} builder bound to the given entity class and adapters.
 * ORM packages call this with their own adapters to produce the `seed()` return value.
 */
export function makeSeedBuilder<T extends EntityInstance, TContext extends SeedContext>(
  EntityClass: EntityConstructor<T>,
  metadataAdapter: MetadataAdapter,
  persistenceAdapter: PersistenceAdapter<TContext>,
): SingleSeed<T, TContext> {
  return {
    create: (options?) => create(EntityClass, options, metadataAdapter),
    createMany: (count, options?) =>
      createMany(EntityClass, { count, ...options }, metadataAdapter),
    save: (options) => save(EntityClass, options, metadataAdapter, persistenceAdapter),
    saveMany: (count, options) =>
      saveMany(
        EntityClass,
        { count, ...options } as TContext & { count: number; values?: SeedValues<T> },
        metadataAdapter,
        persistenceAdapter,
      ),
  };
}

/**
 * Returns a {@link MultiSeed} builder bound to the given entity classes and adapters.
 * ORM packages call this with their own adapters to produce the multi-class `seed()` return value.
 */
export function makeMultiSeedBuilder<
  T extends readonly EntityConstructor[],
  TContext extends SeedContext,
>(
  classes: [...T],
  metadataAdapter: MetadataAdapter,
  persistenceAdapter: PersistenceAdapter<TContext>,
): MultiSeed<T, TContext> {
  return {
    create: (context?) => create(classes, context, metadataAdapter) as Promise<MapToInstances<T>>,
    createMany: (count, context?) =>
      createMany(classes, { count, ...context } as CreateManyOptions, metadataAdapter) as Promise<
        MapToInstanceArrays<T>
      >,
    save: (options) =>
      save(classes, options, metadataAdapter, persistenceAdapter) as Promise<MapToInstances<T>>,
    saveMany: (count, options) =>
      saveMany(
        classes,
        { count, ...options } as TContext & { count: number },
        metadataAdapter,
        persistenceAdapter,
      ) as Promise<MapToInstanceArrays<T>>,
  };
}
