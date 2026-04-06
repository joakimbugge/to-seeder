import { parseArgs } from 'node:util';
import { runSeeders } from '../index.js';
import { loadSeeders } from '@joakimbugge/seeder';
import { loadDataSource } from '../utils/loadDataSource.js';
import { isTypeScriptImportError, printTypeScriptError } from './errors.js';

/**
 * Handles the `seed:run` CLI command.
 *
 * Loads all `@Seeder`-decorated classes from the given glob patterns and runs
 * them via `runSeeders`, which handles topological ordering and built-in logging.
 */
export async function seedRunCommand(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      datasource: { type: 'string', short: 'd' },
      'dry-run': { type: 'boolean', short: 'n' },
    },
    allowPositionals: true,
  });

  if (positionals.length === 0) {
    console.error('Usage: seed:run <glob...> [--datasource/-d <path>] [--dry-run/-n]');
    process.exit(1);
  }

  let seeders: Awaited<ReturnType<typeof loadSeeders>>;

  try {
    seeders = await loadSeeders(positionals);
  } catch (err) {
    if (isTypeScriptImportError(err)) {
      printTypeScriptError('seed:run');
      process.exit(1);
    }

    throw err;
  }

  if (seeders.length === 0) {
    console.log('No seeders found.');
    return;
  }

  if (values['dry-run']) {
    console.log('Dry run — seeders will not run\n');
    console.log(`${seeders.length} seeder${seeders.length === 1 ? '' : 's'} found:`);
    seeders.forEach((s) => console.log(`  ${s.name}`));
    return;
  }

  const dataSource = await loadDataSource(values.datasource);

  try {
    await runSeeders(seeders, { dataSource });
  } finally {
    await dataSource.destroy();
  }
}
