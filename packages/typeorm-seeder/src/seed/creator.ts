import { getMetadataArgsStorage } from 'typeorm';
import { getSeeds } from './registry.js';
import type {
  EntityConstructor,
  EntityInstance,
  MapToInstanceArrays,
  MapToInstances,
  SeedContext,
} from './registry.js';

export interface CreateManySeedOptions extends SeedContext {
  count: number;
}

// Internal extension of SeedContext — never exposed in the public API.
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

    record[propertyKey] = await factory(context);
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
