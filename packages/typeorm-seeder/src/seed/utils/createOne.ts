import { getMetadataArgsStorage } from 'typeorm';
import type { EntityConstructor, EntityInstance, SeedContext, SeedFactory } from '../registry.js';
import { getSeeds } from '../registry.js';

/**
 * A map of property overrides for seeded entities.
 * Each property can be either a static value or a {@link SeedFactory} that is called
 * once per entity — enabling unique random values across each created instance.
 */
export type SeedValues<T extends EntityInstance> = {
  [K in keyof T]?: T[K] | SeedFactory<T[K], T>;
};

interface InternalContext extends SeedContext {
  _ancestors: Set<Function>;
}

function getAncestors(context: SeedContext): Set<Function> {
  return (context as InternalContext)._ancestors ?? new Set();
}

function withAncestor(context: SeedContext, cls: Function): InternalContext {
  const ancestors = getAncestors(context);

  return { ...context, _ancestors: new Set([...ancestors, cls]) };
}

function getClassHierarchy(target: Function): Function[] {
  const hierarchy: Function[] = [];
  let current: Function = target;

  while (current && current !== Function.prototype) {
    hierarchy.push(current);
    current = Object.getPrototypeOf(current) as Function;
  }

  return hierarchy;
}

/** Applies a values map to one seeded entity instance. */
export async function applyValues<T extends EntityInstance>(
  instance: T,
  values: SeedValues<T>,
  context: SeedContext,
  index: number,
): Promise<void> {
  const record = instance as Record<string | symbol, unknown>;

  for (const key of Object.keys(values) as (keyof T & string)[]) {
    const value = values[key];

    if (typeof value === 'function') {
      record[key] = await (value as SeedFactory)(context, instance, index);
    } else {
      record[key] = value;
    }
  }
}

export async function createManyInstances<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  count: number,
  context: SeedContext,
): Promise<T[]> {
  return await Promise.all(
    Array.from({ length: count }, (_, i) => createOne(EntityClass, context, i)),
  );
}

/**
 * Creates one fully populated instance of `EntityClass` in memory.
 * Handles explicit factories, embeddeds, and relation seeding with cycle protection.
 */
export async function createOne<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  context: SeedContext,
  index = 0,
): Promise<T> {
  const instance = new EntityClass();
  const ancestors = getAncestors(context);
  const childContext = withAncestor(context, EntityClass);
  const storage = getMetadataArgsStorage();
  const relations = storage.filterRelations(getClassHierarchy(EntityClass));
  const seededProperties = new Set<string | symbol>();
  const record = instance as Record<string | symbol, unknown>;

  for (const { propertyKey, factory } of getSeeds(EntityClass)) {
    if (!factory) {
      continue;
    }

    record[propertyKey] = await factory(context, instance, index);
    seededProperties.add(propertyKey);
  }

  for (const embedded of storage.filterEmbeddeds(EntityClass)) {
    if (seededProperties.has(embedded.propertyName)) {
      continue;
    }

    const EmbeddedClass = embedded.type() as EntityConstructor;

    if (getSeeds(EmbeddedClass).length > 0) {
      record[embedded.propertyName] = await createOne(EmbeddedClass, context);
      seededProperties.add(embedded.propertyName);
    }
  }

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
      record[propertyKey] = await createManyInstances(
        RelatedClass,
        options.count ?? 1,
        childContext,
      );
    } else {
      record[propertyKey] = await createOne(RelatedClass, childContext);
    }

    seededProperties.add(propertyKey);
  }

  return instance;
}
