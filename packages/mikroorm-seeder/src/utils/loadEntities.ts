import { importGlob } from './importGlob.js';
import { collectConstructors } from './collectConstructors.js';
import type { EntityConstructor, EntityInstance } from '@joakimbugge/seeder';

/**
 * Resolves a mixed array of entity constructors and glob patterns into a flat
 * array of entity constructors.
 *
 * Constructor entries are passed through as-is. String entries are treated as glob
 * patterns, expanded to file paths, and each matched file is dynamically imported.
 * Every exported value that is a class constructor is collected as an entity.
 *
 * @example
 * const classes = await loadEntities(['dist/entities/*.js'])
 * const users = await seed(classes).saveMany(10, { em })
 */
export async function loadEntities(
  sources: (EntityConstructor | string)[],
): Promise<EntityConstructor[]> {
  const classes: EntityConstructor[] = [];
  const patterns: string[] = [];

  for (const source of sources) {
    if (typeof source === 'string') {
      patterns.push(source);
    } else {
      classes.push(source);
    }
  }

  if (patterns.length === 0) {
    return classes;
  }

  const modules = await importGlob(patterns);

  for (const mod of modules) {
    collectConstructors<EntityConstructor<EntityInstance>>(mod, classes);
  }

  return classes;
}
