import type { EntityConstructor, MetadataAdapter } from '@joakimbugge/seeder';
import { MetadataStorage, ReferenceKind } from '@mikro-orm/core';

/**
 * Returns MikroORM property metadata for all classes in the hierarchy.
 * Properties are keyed by name; later (child) entries override earlier (parent) ones.
 */
function getMetadata(hierarchy: EntityConstructor[]) {
  const result: Record<string, { kind: string; entity?: () => unknown }> = {};

  for (const cls of [...hierarchy].reverse()) {
    try {
      const path = (cls as unknown as Record<symbol, unknown>)[
        MetadataStorage.PATH_SYMBOL as symbol
      ] as string | undefined;

      const meta = path ? MetadataStorage.getMetadata(cls.name, path) : null;

      if (meta?.properties) {
        for (const [propName, prop] of Object.entries(meta.properties)) {
          result[propName] = prop;
        }
      }
    } catch {
      // Class isn't registered with MikroORM.
    }
  }

  return result;
}

export const metadataAdapter: MetadataAdapter = {
  getEmbeds(hierarchy) {
    const properties = getMetadata(hierarchy);

    return Object.entries(properties)
      .filter(([, p]) => p.kind === ReferenceKind.EMBEDDED && typeof p.entity === 'function')
      .map(([propName, p]) => ({
        propertyName: propName,
        getClass: p.entity as () => EntityConstructor,
      }));
  },

  getRelations(hierarchy) {
    const properties = getMetadata(hierarchy);
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
        getClass: p.entity as () => EntityConstructor,
        isArray: p.kind === ReferenceKind.ONE_TO_MANY || p.kind === ReferenceKind.MANY_TO_MANY,
      }));
  },
};
