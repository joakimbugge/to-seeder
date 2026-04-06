import { MetadataStorage, ReferenceKind } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/core';
import type {
  EmbeddedEntry,
  EntityConstructor,
  EntityInstance,
  MetadataAdapter,
  PersistenceAdapter,
  RelationEntry,
  SeedContext,
} from '@joakimbugge/seeder';

/**
 * Returns MikroORM property metadata for all classes in the hierarchy.
 * Properties are keyed by name; later (child) entries override earlier (parent) ones.
 */
function getMikroOrmProperties(
  hierarchy: EntityConstructor[],
): Record<string, { kind: string; entity?: () => unknown }> {
  const result: Record<string, { kind: string; entity?: () => unknown }> = {};

  for (const cls of [...hierarchy].reverse()) {
    try {
      const path = (cls as unknown as Record<symbol, unknown>)[
        MetadataStorage.PATH_SYMBOL as symbol
      ] as string | undefined;
      const meta = path ? MetadataStorage.getMetadata(cls.name, path) : null;
      if (meta?.properties) {
        for (const [propName, prop] of Object.entries(meta.properties)) {
          result[propName] = prop as { kind: string; entity?: () => unknown };
        }
      }
    } catch {
      // Class not registered with MikroORM.
    }
  }

  return result;
}

export const mikroOrmAdapter: MetadataAdapter = {
  getEmbeddeds(hierarchy: EntityConstructor[]): EmbeddedEntry[] {
    const properties = getMikroOrmProperties(hierarchy);

    return Object.entries(properties)
      .filter(([, p]) => p.kind === ReferenceKind.EMBEDDED && typeof p.entity === 'function')
      .map(([propName, p]) => ({
        propertyName: propName,
        getClass: p.entity as () => never,
      }));
  },

  getRelations(hierarchy: EntityConstructor[]): RelationEntry[] {
    const properties = getMikroOrmProperties(hierarchy);
    const relationKinds = new Set([
      ReferenceKind.MANY_TO_ONE,
      ReferenceKind.ONE_TO_ONE,
      ReferenceKind.ONE_TO_MANY,
      ReferenceKind.MANY_TO_MANY,
    ]);

    return Object.entries(properties)
      .filter(
        ([, p]) => relationKinds.has(p.kind as ReferenceKind) && typeof p.entity === 'function',
      )
      .map(([propName, p]) => ({
        propertyName: propName,
        getClass: p.entity as () => never,
        isArray: p.kind === ReferenceKind.ONE_TO_MANY || p.kind === ReferenceKind.MANY_TO_MANY,
      }));
  },
};

/** Context required when persisting entities — `em` is mandatory. */
export interface MikroOrmPersistContext extends SeedContext {
  em: EntityManager;
}

export const mikroOrmPersistenceAdapter: PersistenceAdapter<MikroOrmPersistContext> = {
  async save<T extends EntityInstance>(
    _EntityClass: EntityConstructor<T>,
    entities: T[],
    context: MikroOrmPersistContext,
  ): Promise<T[]> {
    const { em } = context;

    for (const entity of entities) {
      em.persist(entity);
    }

    await em.flush();

    return entities;
  },
};
