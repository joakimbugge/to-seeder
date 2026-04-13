import type { MetadataAdapter } from '../adapter.js';
import type { EntityConstructor, EntityInstance, SeedContext, SeedFactory } from '../registry.js';
import { getSeeds } from '../registry.js';

/**
 * A map of property overrides for seeded entities.
 * Each property can be either a static value or a {@link SeedFactory} that is called
 * once per entity — enabling unique random values across each created instance.
 */
export type SeedValues<T extends EntityInstance> = {
  [K in keyof T]?: T[K] | SeedFactory<T[K], T, SeedContext>;
};

interface InternalContext extends SeedContext {
  _ancestors: Set<EntityConstructor>;
}

function getAncestors(context: SeedContext) {
  return (context as InternalContext)._ancestors ?? new Set();
}

function withAncestor(context: SeedContext, cls: EntityConstructor) {
  const ancestors = getAncestors(context);

  // Inherit `previous` as-is. Child factories can read parent-batch entries via
  // ctx.previous?.get(ParentClass). The child's own type starts empty because
  // createManyInstances resets that entry at the start of each new batch.
  return { ...context, _ancestors: new Set([...ancestors, cls]) };
}

export function getClassHierarchy(target: EntityConstructor) {
  const hierarchy: EntityConstructor[] = [];
  let current: EntityConstructor | null = target;

  while (current && current !== Function.prototype) {
    hierarchy.push(current);
    current = Object.getPrototypeOf(current) as EntityConstructor | null;
  }

  return hierarchy;
}

/** Applies a values map to one seeded entity instance. */
export async function applyValues<T extends EntityInstance>(
  instance: T,
  values: SeedValues<T>,
  context: SeedContext,
  index: number,
) {
  const record = instance as Record<string | symbol, unknown>;

  for (const key of Object.keys(values) as (keyof T & string)[]) {
    const value = values[key];

    if (typeof value === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      record[key] = await (value as SeedFactory<unknown, any, any>)(context, instance, index);
    } else {
      record[key] = value;
    }
  }
}

/** Internal batch options — includes `previous` for the creation pipeline. Not part of the public API. */
interface BatchOptions<T extends EntityInstance> extends SeedContext {
  count: number;
  values?: SeedValues<T>;
}

export async function createManyInstances<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  options: BatchOptions<T>,
  adapter: MetadataAdapter,
) {
  const instances: T[] = [];

  for (let i = 0; i < options.count; i++) {
    // Build a new Map each iteration so each instance gets a stable snapshot.
    // Inherit all parent entries, then set this type's entry to a snapshot of
    // completed instances so far — unrelated sibling batches of the same type
    // are never visible because each batch starts fresh from the parent Map.
    const previous = new Map(options.previous ?? []);
    previous.set(EntityClass, [...instances]);
    instances.push(await createOne(EntityClass, { ...options, previous }, i, adapter));
  }

  return instances;
}

/**
 * Creates one fully populated instance of `EntityClass` in memory.
 * Handles explicit factories, embeddeds, and relation seeding with cycle protection.
 * ORM-specific metadata is provided via the {@link MetadataAdapter}.
 */
export async function createOne<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  context: SeedContext,
  index: number,
  adapter: MetadataAdapter,
) {
  const instance = new EntityClass();
  const ancestors = getAncestors(context);
  const childContext = withAncestor(context, EntityClass);
  const hierarchy = getClassHierarchy(EntityClass);
  const seededProperties = new Set<string | symbol>();
  const record = instance as Record<string | symbol, unknown>;

  for (const { propertyKey, factory } of getSeeds(EntityClass)) {
    if (!factory) {
      continue;
    }

    record[propertyKey] = await factory(context, instance, index);
    seededProperties.add(propertyKey);
  }

  for (const { propertyName, getClass } of adapter.getEmbeds(hierarchy)) {
    if (seededProperties.has(propertyName)) {
      continue;
    }

    const EmbeddedClass = getClass();

    if (getSeeds(EmbeddedClass).length > 0) {
      record[propertyName] = await createOne(EmbeddedClass, childContext, index, adapter);
      seededProperties.add(propertyName);
    }
  }

  if (context.relations === false) {
    return instance;
  }

  const allRelations = adapter.getRelations(hierarchy);

  for (const { propertyKey, factory, options } of getSeeds(EntityClass)) {
    if (factory || seededProperties.has(propertyKey)) {
      continue;
    }

    const relation = allRelations.find((r) => r.propertyName === String(propertyKey));

    if (!relation) {
      continue;
    }

    const RelatedClass = relation.getClass();

    if (ancestors.has(RelatedClass)) {
      continue;
    }

    if (relation.isArray) {
      record[propertyKey] = await createManyInstances(
        RelatedClass,
        { ...childContext, count: options.count ?? 1 },
        adapter,
      );
    } else {
      record[propertyKey] = await createOne(RelatedClass, childContext, 0, adapter);
    }

    seededProperties.add(propertyKey);
  }

  return instance;
}
