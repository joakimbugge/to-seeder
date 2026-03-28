import { type DataSource } from 'typeorm';
import { createMany } from './creator.js';
import type { SeedValues } from './creator.js';
import type {
  EntityConstructor,
  EntityInstance,
  MapToInstanceArrays,
  MapToInstances,
  SeedContext,
} from './registry.js';

/** Options for {@link save}. Extends {@link SeedContext} with a required DataSource. */
export interface SaveOptions<T extends EntityInstance = EntityInstance> extends SeedContext {
  dataSource: DataSource;
  /**
   * Property values to apply to each entity after seeding and before persisting.
   * Wins unconditionally over `@Seed` factory output — the factory still runs,
   * but its result is overwritten. Also works for properties that have no `@Seed`
   * decorator at all.
   *
   * @example
   * const users = await dataSource.getRepository(User).find()
   * const user = faker.helpers.arrayElement(users)
   * await seed(Booking).saveMany(10, { dataSource, values: { user } })
   */
  values?: SeedValues<T>;
}

/** Options for {@link saveMany}. Extends {@link SaveOptions} with a required instance count. */
export interface SaveManyOptions<T extends EntityInstance = EntityInstance> extends SaveOptions<T> {
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
 */
export async function save<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options: SaveOptions<T>,
): Promise<T>;
/**
 * Creates and persists one instance of each entity class in the array.
 * Relation seeding is disabled by default; pass `relations: true` to override.
 */
export async function save<T extends readonly EntityConstructor[]>(
  EntityClasses: [...T],
  options: SaveOptions,
): Promise<MapToInstances<T>>;
export async function save<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
  options: SaveOptions<T>,
): Promise<T | EntityInstance[]> {
  if (Array.isArray(classOrClasses)) {
    const effectiveOptions = { relations: false, ...options, count: 1 };

    return (await Promise.all(
      (classOrClasses as EntityConstructor[]).map((cls) =>
        saveBatch(cls, effectiveOptions).then(([entity]) => entity!),
      ),
    )) as EntityInstance[];
  }

  const [entity] = await saveBatch(classOrClasses as EntityConstructor<T>, {
    ...options,
    count: 1,
  });

  return entity!;
}

/**
 * Creates and persists multiple seed entities of the same class.
 * Applies the same logic as {@link save} for each entity.
 */
export async function saveMany<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options: SaveManyOptions<T>,
): Promise<T[]>;
/**
 * Creates and persists multiple instances of each entity class in the array.
 * Relation seeding is disabled by default; pass `relations: true` to override.
 */
export async function saveMany<T extends readonly EntityConstructor[]>(
  EntityClasses: [...T],
  options: SaveManyOptions,
): Promise<MapToInstanceArrays<T>>;
export async function saveMany<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
  options: SaveManyOptions<T>,
): Promise<T[] | EntityInstance[][]> {
  if (Array.isArray(classOrClasses)) {
    const effectiveOptions = { relations: false, ...options };

    return (await Promise.all(
      (classOrClasses as EntityConstructor[]).map((cls) => saveBatch(cls, effectiveOptions)),
    )) as EntityInstance[][];
  }

  return await saveBatch(classOrClasses as EntityConstructor<T>, options);
}

/**
 * Returns true when EntityClass uses one of TypeORM's four tree strategies
 * (`adjacency-list`, `materialized-path`, `closure-table`, `nested-set`).
 */
function isTreeEntity(EntityClass: Function, dataSource: DataSource): boolean {
  try {
    return !!dataSource.getMetadata(EntityClass).treeType;
  } catch {
    return false;
  }
}

/**
 * Saves a single tree entity in three phases to satisfy TypeORM's tree executor requirements.
 *
 * TypeORM's tree executors (`MaterializedPathSubjectExecutor`, `NestedSetSubjectExecutor`,
 * closure-table logic) cannot handle a fully-connected in-memory graph saved in one shot:
 * - Materialized-path needs the parent's DB-assigned path before computing the child's path.
 * - Nested-set needs to query existing left/right ranges before inserting a new node.
 * - Closure-table needs the parent row present in the DB before writing closure-table rows.
 *
 * The three phases are:
 * 1. Save the parent node (no dependencies) so it gets a DB-assigned ID/path/range.
 * 2. Save the root with `parent` set but `children = []` — the executor sees a clean single-node save.
 * 3. Save each child with `parent = savedRoot` so paths/ranges/closure rows are computed correctly.
 */
async function saveTreeEntity<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  entity: T,
  dataSource: DataSource,
): Promise<T> {
  const metadata = dataSource.getMetadata(EntityClass);
  const repo = dataSource.getTreeRepository(EntityClass);

  const parentRelation = metadata.relations.find((r) => r.isTreeParent);
  const childrenRelation = metadata.relations.find((r) => r.isTreeChildren);

  const parentProp = parentRelation?.propertyName as keyof T | undefined;
  const childrenProp = childrenRelation?.propertyName as keyof T | undefined;

  const parent = parentProp ? (entity[parentProp] as T | undefined) : undefined;
  const children = childrenProp ? ((entity[childrenProp] as T[] | undefined) ?? []) : [];

  // Phase 1: save the parent node so it has a DB-assigned ID.
  let savedParent: T | undefined;

  if (parent) {
    [savedParent] = (await repo.save([parent])) as T[];
  }

  // Phase 2: save root without children so the tree executor can assign its path/range
  // relative to the parent without needing sibling context.
  if (parentProp && savedParent) {
    (entity as Record<string, unknown>)[String(parentProp)] = savedParent;
  }

  if (childrenProp) {
    (entity as Record<string, unknown>)[String(childrenProp)] = [];
  }

  const [savedRoot] = (await repo.save([entity])) as T[];

  // Phase 3: save children with root as their parent so paths/ranges/closure rows are correct.
  if (children.length > 0 && parentProp) {
    for (const child of children) {
      (child as Record<string, unknown>)[String(parentProp)] = savedRoot;
    }

    await repo.save(children);
    (savedRoot as Record<string, unknown>)[String(childrenProp!)] = children;
  }

  return savedRoot as T;
}

/**
 * Creates and persists `count` instances of a single entity class.
 *
 * For regular entities this uses a single batched `repository.save()` call, which is
 * more efficient because TypeORM can consolidate the inserts.
 *
 * For tree entities (`@Tree(...)`) a phased save is used instead: parent first, then
 * root without children, then children with the root as parent. This satisfies the
 * ordering requirements of TypeORM's tree executors for all four strategies.
 */
async function saveBatch<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options: SaveManyOptions<T>,
): Promise<T[]> {
  const { count, dataSource } = options;

  if (count === 0) {
    return [];
  }

  const entities = await createMany(EntityClass, options);

  if (isTreeEntity(EntityClass, dataSource)) {
    return await Promise.all(
      entities.map((entity) => saveTreeEntity(EntityClass, entity, dataSource)),
    );
  }

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
