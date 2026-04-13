import type {
  EntityConstructor,
  EntityInstance,
  PersistenceAdapter,
  SeedContext,
} from '@joakimbugge/seeder';
import type { DataSource } from 'typeorm';

/** Context required when persisting entities — `dataSource` is mandatory. */
export interface PersistContext extends Omit<SeedContext, 'previous'> {
  dataSource: DataSource;
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

function collectEntityClasses(entity: EntityInstance, visited = new Set<EntityConstructor>()) {
  const EntityClass = entity.constructor as EntityConstructor;

  if (visited.has(EntityClass)) {
    return [];
  }

  visited.add(EntityClass);

  const classes = [EntityClass];

  for (const value of Object.values(entity)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && item.constructor !== Object) {
          classes.push(...collectEntityClasses(item, visited));
        }
      }
    } else if (value && typeof value === 'object' && value.constructor !== Object) {
      classes.push(...collectEntityClasses(value, visited));
    }
  }

  return classes;
}

function enableCascadeInsert(EntityClass: EntityConstructor, dataSource: DataSource) {
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

function restoreCascade(states: CascadeState[]) {
  for (const { relation, original } of states) {
    relation.isCascadeInsert = original;
  }
}

function isTreeEntity(EntityClass: EntityConstructor, dataSource: DataSource) {
  try {
    return !!dataSource.getMetadata(EntityClass).treeType;
  } catch {
    return false;
  }
}

async function saveTreeEntity<T extends EntityInstance>(
  EntityClass: EntityConstructor<T>,
  entity: T,
  dataSource: DataSource,
) {
  const metadata = dataSource.getMetadata(EntityClass);
  const repo = dataSource.getTreeRepository(EntityClass);

  const parentRelation = metadata.relations.find((r) => r.isTreeParent);
  const childrenRelation = metadata.relations.find((r) => r.isTreeChildren);

  const parentProp = parentRelation?.propertyName as keyof T | undefined;
  const childrenProp = childrenRelation?.propertyName as keyof T | undefined;

  const parent = parentProp ? (entity[parentProp] as T | undefined) : undefined;
  const children = childrenProp ? ((entity[childrenProp] as T[] | undefined) ?? []) : [];

  let savedParent: T | undefined;

  if (parent) {
    [savedParent] = await repo.save([parent]);
  }

  if (parentProp && savedParent) {
    (entity as Record<string, unknown>)[String(parentProp)] = savedParent;
  }

  if (childrenProp) {
    (entity as Record<string, unknown>)[String(childrenProp)] = [];
  }

  const [savedRoot] = await repo.save([entity]);

  if (children.length > 0 && parentProp) {
    for (const child of children) {
      (child as Record<string, unknown>)[String(parentProp)] = savedRoot;
    }

    await repo.save(children);
    (savedRoot as Record<string, unknown>)[String(childrenProp!)] = children;
  }

  return savedRoot;
}

export const persistenceAdapter: PersistenceAdapter<PersistContext> = {
  async save(EntityClass, entities, context) {
    const { dataSource } = context;

    if (isTreeEntity(EntityClass, dataSource)) {
      return Promise.all(entities.map((entity) => saveTreeEntity(EntityClass, entity, dataSource)));
    }

    const visited = new Set<EntityConstructor>();
    const states = entities
      .flatMap((entity) => collectEntityClasses(entity, visited))
      .flatMap((cls) => enableCascadeInsert(cls, dataSource));

    try {
      return await dataSource.getRepository(EntityClass).save(entities);
    } finally {
      restoreCascade(states);
    }
  },
};
