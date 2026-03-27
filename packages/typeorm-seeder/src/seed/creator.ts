import { getMetadataArgsStorage } from 'typeorm';
import { getSeeds } from './registry.js';
import type {
  EntityConstructor,
  EntityInstance,
  MapToInstanceArrays,
  MapToInstances,
  SeedContext,
} from './registry.js';

/** Options for {@link createManySeed}. Extends {@link SeedContext} with a required instance count. */
export interface CreateManySeedOptions extends SeedContext {
  count: number;
}

// Internal extension of SeedContext — never exposed in the public API.
interface InternalContext extends SeedContext {
  _ancestors: Set<Function>;
}

/** Extracts the ancestor set from an internal context, returning an empty set for external callers. */
function getAncestors(context: SeedContext): Set<Function> {
  return (context as InternalContext)._ancestors ?? new Set();
}

/** Returns a new context with `cls` added to the ancestor set, used to detect circular relation chains. */
function withAncestor(context: SeedContext, cls: Function): InternalContext {
  const ancestors = getAncestors(context);

  return { ...context, _ancestors: new Set([...ancestors, cls]) };
}

/** Walks the prototype chain and returns all classes from `target` up to (but not including) `Function.prototype`. */
function getClassHierarchy(target: Function): Function[] {
  const hierarchy: Function[] = [];
  let current: Function = target;

  while (current && current !== Function.prototype) {
    hierarchy.push(current);
    current = Object.getPrototypeOf(current) as Function;
  }

  return hierarchy;
}

/**
 * Creates one fully populated instance of `EntityClass` in memory.
 *
 * Runs in three steps:
 * 1. Factory-decorated properties (`@Seed(factory)`) — run first, in declaration order.
 * 2. Embedded types (`@Embedded`) — auto-seeded if the embedded class has any `@Seed` entries.
 * 3. Bare relation decorators (`@Seed()` without a factory) — skipped when `relations` is `false`,
 *    and also skipped for any related class already present in the ancestor chain (circular guard).
 */
async function createOneSeed<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  context: SeedContext,
): Promise<T> {
  const instance = new EntityClass();
  const ancestors = getAncestors(context);
  const childContext = withAncestor(context, EntityClass);
  const storage = getMetadataArgsStorage();
  const relations = storage.filterRelations(getClassHierarchy(EntityClass));
  const seededProperties = new Set<string | symbol>();
  const record = instance as Record<string | symbol, unknown>;

  // Step 1: Run @Seed entries that have an explicit factory.
  for (const { propertyKey, factory } of getSeeds(EntityClass)) {
    if (!factory) {
      continue;
    }

    record[propertyKey] = await factory(context, instance);
    seededProperties.add(propertyKey);
  }

  // Step 2: Auto-seed TypeORM embedded properties not already covered by Step 1.
  for (const embedded of storage.filterEmbeddeds(EntityClass)) {
    if (seededProperties.has(embedded.propertyName)) {
      continue;
    }

    const EmbeddedClass = embedded.type() as EntityConstructor;

    if (getSeeds(EmbeddedClass).length > 0) {
      record[embedded.propertyName] = await createOneSeed(EmbeddedClass, context);
      seededProperties.add(embedded.propertyName);
    }
  }

  // Step 3: Auto-seed @Seed entries without a factory (relation seeds).
  // Uses the ancestor guard to cut circular chains: if the related class is
  // already being seeded higher up in this call chain, the property is left
  // undefined rather than triggering infinite recursion.
  // Skipped entirely when context.relations === false.
  if (context.relations === false) {
    return instance;
  }

  for (const { propertyKey, factory, options } of getSeeds(EntityClass)) {
    if (factory || seededProperties.has(propertyKey)) {
      continue;
    }

    const relation = relations.find((r) => r.propertyName === String(propertyKey));

    if (!relation || typeof relation.type !== 'function') {
      continue;
    }

    const RelatedClass = (relation.type as () => Function)() as EntityConstructor;

    if (ancestors.has(RelatedClass)) {
      continue;
    }

    const isArray =
      relation.relationType === 'one-to-many' || relation.relationType === 'many-to-many';

    if (isArray) {
      record[propertyKey] = await createManySeed(RelatedClass, {
        count: options.count ?? 1,
        ...childContext,
      });
    } else {
      record[propertyKey] = await createOneSeed(RelatedClass, childContext);
    }

    seededProperties.add(propertyKey);
  }

  return instance;
}

/**
 * Creates one entity instance in memory without persisting it.
 *
 * When passed an array of classes, relation seeding is disabled by default
 * (pass `relations: true` in the context to override). Returns a tuple of
 * instances in the same order as the input array.
 */
export async function createSeed<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  context?: SeedContext,
): Promise<T>;
export async function createSeed<T extends readonly EntityConstructor[]>(
  EntityClasses: [...T],
  context?: SeedContext,
): Promise<MapToInstances<T>>;
export async function createSeed<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
  context: SeedContext = {},
): Promise<T | EntityInstance[]> {
  if (Array.isArray(classOrClasses)) {
    const effectiveContext: SeedContext = { relations: false, ...context };

    return (await Promise.all(
      (classOrClasses as EntityConstructor[]).map((cls) => createOneSeed(cls, effectiveContext)),
    )) as EntityInstance[];
  }

  const [entity] = await createManySeed(classOrClasses as EntityConstructor<T>, {
    count: 1,
    ...context,
  });

  return entity!;
}

/**
 * Creates multiple entity instances in memory without persisting them.
 *
 * When passed an array of classes, returns a tuple of arrays — one per class — each
 * containing `count` instances. Relation seeding is disabled by default for the
 * array variant; pass `relations: true` in the options to override.
 */
export async function createManySeed<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options: CreateManySeedOptions,
): Promise<T[]>;
export async function createManySeed<T extends readonly EntityConstructor[]>(
  EntityClasses: [...T],
  options: CreateManySeedOptions,
): Promise<MapToInstanceArrays<T>>;
export async function createManySeed<T extends EntityInstance>(
  classOrClasses: EntityConstructor<T> | readonly EntityConstructor[],
  { count, ...context }: CreateManySeedOptions,
): Promise<T[] | EntityInstance[][]> {
  if (Array.isArray(classOrClasses)) {
    const effectiveContext: SeedContext = { relations: false, ...context };

    return (await Promise.all(
      (classOrClasses as EntityConstructor[]).map((cls) =>
        Promise.all(Array.from({ length: count }, () => createOneSeed(cls, effectiveContext))),
      ),
    )) as EntityInstance[][];
  }

  return await Promise.all(
    Array.from({ length: count }, () =>
      createOneSeed(classOrClasses as EntityConstructor<T>, context),
    ),
  );
}
