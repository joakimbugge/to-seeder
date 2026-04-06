import { importGlob } from './importGlob.js';
import { collectConstructors } from './collectConstructors.js';
import { getSeederMeta } from '../seeder/registry.js';
import type { SeederCtor } from '../seeder/runner.js';

/**
 * Resolves a mixed array of seeder constructors and glob patterns into a flat
 * array of seeder constructors — the same format accepted by {@link runSeeders}.
 *
 * Constructor entries are passed through as-is. String entries are treated as glob
 * patterns, expanded to file paths, and each matched file is dynamically imported.
 * Only exported values decorated with `@Seeder` are collected — other exports are ignored.
 *
 * @example
 * const seeders = await loadSeeders(['dist/seeders/**\/*.js'])
 * await runSeeders(seeders, options)
 *
 * @example
 * const seeders = await loadSeeders([UserSeeder, 'dist/seeders/Post*.js'])
 * await runSeeders(seeders, options)
 */
export async function loadSeeders(sources: (SeederCtor | string)[]): Promise<SeederCtor[]> {
  const classes: SeederCtor[] = [];
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
    collectConstructors<SeederCtor>(mod, classes, (fn) => !!getSeederMeta(fn));
  }

  return classes;
}
