import { inspect, parseArgs } from 'node:util';
import { loadEntities, seed } from '../index.js';
import { getSeeds } from '../seed/registry.js';
import { loadDataSource } from '../utils/loadDataSource.js';
import { isTypeScriptImportError, printTypeScriptError } from './errors.js';

/**
 * Handles the `seed:entities` CLI command.
 *
 * Loads entity constructors from the given glob patterns, filters to those with
 * at least one `@Seed` decorator, then seeds and persists `count` instances of each.
 */
export async function seedEntitiesCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      datasource: { type: 'string', short: 'd' },
      count: { type: 'string', default: '1' },
      'dry-run': { type: 'boolean', short: 'n' },
    },
    allowPositionals: true,
  });

  if (positionals.length === 0) {
    console.error(
      'Usage: seed:entities <glob...> [--datasource/-d <path>] [--count N=1] [--dry-run/-n]',
    );
    process.exit(1);
  }

  const count = parseInt(values.count!, 10);

  if (isNaN(count) || count < 1) {
    console.error('Error: --count must be a positive integer.');
    process.exit(1);
  }

  let entities: Awaited<ReturnType<typeof loadEntities>>;

  try {
    entities = await loadEntities(positionals);
  } catch (err) {
    if (isTypeScriptImportError(err)) {
      printTypeScriptError('seed:entities');
      process.exit(1);
    }

    throw err;
  }

  const seeded = entities.filter((EntityClass) => getSeeds(EntityClass).length > 0);

  if (seeded.length === 0) {
    console.log('No entities with @Seed decorators found.');
    return;
  }

  if (values['dry-run']) {
    console.log('Dry run — nothing will be written to the database\n');

    for (const EntityClass of seeded) {
      const instances = await seed(EntityClass).createMany(count);

      console.log(`${count} × ${EntityClass.name}`);

      for (const instance of instances) {
        console.log(inspect(instance, { depth: null, colors: true, compact: false }));
      }

      console.log();
    }

    return;
  }

  const dataSource = await loadDataSource(values.datasource);

  try {
    for (const EntityClass of seeded) {
      await seed(EntityClass).saveMany(count, { dataSource });
      console.log(`Seeded ${count} × ${EntityClass.name}`);
    }
  } finally {
    await dataSource.destroy();
  }
}
