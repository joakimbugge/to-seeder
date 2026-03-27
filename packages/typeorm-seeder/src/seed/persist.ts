import { type DataSource } from 'typeorm';

import { createManySeed } from './creator.js';
import type {
  EntityConstructor,
  EntityInstance,
  MapToInstanceArrays,
  MapToInstances,
  SeedContext,
} from './registry.js';

/** Options for {@link saveSeed}. Extends {@link SeedContext} with a required DataSource. */
export interface SaveSeedOptions extends SeedContext {
  dataSource: DataSource;
}

/** Options for {@link saveManySeed}. Extends {@link SaveSeedOptions} with a required instance count. */
export interface SaveManySeedOptions extends SaveSeedOptions {
  count: number;
}

type RelationMetadata = DataSource extends { getMetadata(...args: never[]): infer M }
  ? M extends { relations: Array<infer R> }
    ? R
    : never
  : never;

interface CascadeState {
  relation: RelationMetadata;
  original: boolean;
}

/**
 * Walks an entity object graph and collects every unique entity class encountered.
 * Used to discover all entity classes that need cascade-insert temporarily enabled
 * before saving so that the full in-memory graph is persisted in one shot.
 */
function collectEntityClasses(entity: EntityInstance, visited = new Set<Function>()): Function[] {
  const EntityClass = entity.constructor as Function;

  if (visited.has(EntityClass)) {
    return [];
  }

  visited.add(EntityClass);

  const classes: Function[] = [EntityClass];

  for (const value of Object.values(entity)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && item.constructor !== Object) {
          classes.push(...collectEntityClasses(item, visited));
        }
      }
    } else if (value && typeof value === 'object' && value.constructor !== Object) {
      classes.push(...collectEntityClasses(value as EntityInstance, visited));
    }
  }

  return classes;
}

/**
 * Temporarily enables `isCascadeInsert` on every TypeORM relation for the given class.
 * Returns the previous flag values so they can be restored after saving.
 *
 * This is necessary because the seeder builds the full object graph in memory before
 * calling `save()`. Without cascade inserts, TypeORM would only persist the root entity
 * and ignore any nested relations that weren't already configured with `cascade: true`.
 *
 * Classes not registered as TypeORM entities (e.g. embedded value objects) are silently skipped.
 */
function enableCascadeInsert(EntityClass: Function, dataSource: DataSource): CascadeState[] {
  const states: CascadeState[] = [];

  try {
    const relations = dataSource.getMetadata(EntityClass).relations;

    for (const relation of relations) {
      states.push({ relation, original: relation.isCascadeInsert });
      relation.isCascadeInsert = true;
    }
  } catch {
    // Class is not registered as an entity with this DataSource (e.g. embedded class).
  }

  return states;
}

/**
 * Restores `isCascadeInsert` flags to their original values.
 * Always called in a `finally` block to guarantee cleanup even when saving throws.
 */
function restoreCascade(states: CascadeState[]): void {
  for (const { relation, original } of states) {
    relation.isCascadeInsert = original;
  }
}

/**
 * Creates and persists a seed entity and all its seeded relations.
 * Delegates to {@link saveManySeed} with `count: 1` and unwraps the result.
 */
export async function saveSeed<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options: SaveSeedOptions,
): Promise<T>;
/**
 * Creates and persists one instance of each entity class in the array.
 * Relation seeding is disabled by default; pass `relations: true` to override.
 */
export async function saveSeed<T extends readonly EntityConstructor[]>(
  EntityClasses: [...T],
  options: SaveSeedOptions,
): Promise<MapToInstances<T>>;
export async function saveSeed<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
  options: SaveSeedOptions,
): Promise<T | EntityInstance[]> {
  if (Array.isArray(classOrClasses)) {
    const effectiveOptions = { relations: false, ...options, count: 1 };

    return (await Promise.all(
      (classOrClasses as EntityConstructor[]).map((cls) =>
        saveManySeed(cls, effectiveOptions).then(([entity]) => entity!),
      ),
    )) as EntityInstance[];
  }

  const [entity] = await saveManySeed(classOrClasses as EntityConstructor<T>, {
    ...options,
    count: 1,
  });

  return entity!;
}

/**
 * Creates and persists multiple seed entities of the same class.
 * Applies the same logic as {@link saveSeed} for each entity.
 */
export async function saveManySeed<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options: SaveManySeedOptions,
): Promise<T[]>;
/**
 * Creates and persists multiple instances of each entity class in the array.
 * Relation seeding is disabled by default; pass `relations: true` to override.
 */
export async function saveManySeed<T extends readonly EntityConstructor[]>(
  EntityClasses: [...T],
  options: SaveManySeedOptions,
): Promise<MapToInstanceArrays<T>>;
export async function saveManySeed<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
  options: SaveManySeedOptions,
): Promise<T[] | EntityInstance[][]> {
  if (Array.isArray(classOrClasses)) {
    const effectiveOptions = { relations: false, ...options };

    return (await Promise.all(
      (classOrClasses as EntityConstructor[]).map((cls) => saveManySeedOne(cls, effectiveOptions)),
    )) as EntityInstance[][];
  }

  return await saveManySeedOne(classOrClasses as EntityConstructor<T>, options);
}

/**
 * Creates and persists `count` instances of a single entity class.
 * Enables cascade inserts on every entity class in the object graph before saving,
 * then restores the original flags — regardless of whether the save succeeds or fails.
 */
async function saveManySeedOne<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options: SaveManySeedOptions,
): Promise<T[]> {
  const { count, dataSource } = options;

  if (count === 0) {
    return [];
  }

  const entities = await createManySeed(EntityClass, options);

  const visited = new Set<Function>();
  const states = entities
    .flatMap((entity) => collectEntityClasses(entity, visited))
    .flatMap((cls) => enableCascadeInsert(cls, dataSource));

  try {
    return (await dataSource.getRepository(EntityClass).save(entities)) as T[];
  } finally {
    restoreCascade(states);
  }
}
