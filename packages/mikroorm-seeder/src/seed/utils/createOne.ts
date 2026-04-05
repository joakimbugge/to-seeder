import { MetadataStorage, ReferenceKind } from '@mikro-orm/core';
import type { EntityConstructor, EntityInstance, SeedContext, SeedFactory } from '../registry.js';
import { getSeeds } from '../registry.js';

/**
 * A map of property overrides for seeded entities.
 * Each property can be either a static value or a {@link SeedFactory}.
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

/**
 * Returns MikroORM property metadata for all classes in the hierarchy.
 * Properties are keyed by name; later (child) entries override earlier (parent) ones.
 */
function getMikroOrmProperties(
  hierarchy: Function[],
): Record<string, { kind: string; entity?: () => Function }> {
  const result: Record<string, { kind: string; entity?: () => Function }> = {};

  for (const cls of [...hierarchy].reverse()) {
    try {
      const path = (cls as unknown as Record<symbol, unknown>)[
        MetadataStorage.PATH_SYMBOL as symbol
      ] as string | undefined;
      const meta = path ? MetadataStorage.getMetadata(cls.name, path) : null;
      if (meta?.properties) {
        for (const [propName, prop] of Object.entries(meta.properties)) {
          result[propName] = prop as { kind: string; entity?: () => Function };
        }
      }
    } catch {
      // Class not registered with MikroORM.
    }
  }

  return result;
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
 * Handles explicit factories, embedded entities, and relation seeding with cycle protection.
 */
export async function createOne<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  context: SeedContext,
  index = 0,
): Promise<T> {
  const instance = new EntityClass();
  const ancestors = getAncestors(context);
  const childContext = withAncestor(context, EntityClass);
  const hierarchy = getClassHierarchy(EntityClass);
  const properties = getMikroOrmProperties(hierarchy);
  const seededProperties = new Set<string | symbol>();
  const record = instance as Record<string | symbol, unknown>;

  for (const { propertyKey, factory } of getSeeds(EntityClass)) {
    if (!factory) {
      continue;
    }

    record[propertyKey] = await factory(context, instance, index);
    seededProperties.add(propertyKey);
  }

  for (const [propName, prop] of Object.entries(properties)) {
    if (prop.kind !== ReferenceKind.EMBEDDED || seededProperties.has(propName)) {
      continue;
    }

    if (typeof prop.entity !== 'function') {
      continue;
    }

    const EmbeddedClass = prop.entity() as EntityConstructor;

    if (getSeeds(EmbeddedClass).length > 0) {
      record[propName] = await createOne(EmbeddedClass, context);
      seededProperties.add(propName);
    }
  }

  if (context.relations === false) {
    return instance;
  }

  for (const { propertyKey, factory, options } of getSeeds(EntityClass)) {
    if (factory || seededProperties.has(propertyKey)) {
      continue;
    }

    const prop = properties[String(propertyKey)];

    if (!prop) {
      continue;
    }

    const isRelation =
      prop.kind === ReferenceKind.MANY_TO_ONE ||
      prop.kind === ReferenceKind.ONE_TO_ONE ||
      prop.kind === ReferenceKind.ONE_TO_MANY ||
      prop.kind === ReferenceKind.MANY_TO_MANY;

    if (!isRelation || typeof prop.entity !== 'function') {
      continue;
    }

    const RelatedClass = prop.entity() as EntityConstructor;

    if (ancestors.has(RelatedClass)) {
      continue;
    }

    const isArray =
      prop.kind === ReferenceKind.ONE_TO_MANY || prop.kind === ReferenceKind.MANY_TO_MANY;

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
