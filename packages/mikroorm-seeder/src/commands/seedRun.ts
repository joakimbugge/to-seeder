import { parseArgs } from 'node:util';
import { loadSeeders, runSeeders } from '../index.js';
import { loadOrm } from '../utils/loadOrm.js';
import { isTypeScriptImportError, printTypeScriptError } from './errors.js';

/**
 * Handles the `seed:run` CLI command.
 *
 * Loads all `@Seeder`-decorated classes from the given glob patterns and runs
 * them via `runSeeders`, which handles topological ordering and built-in logging.
 */
export async function seedRunCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      orm: { type: 'string', short: 'o' },
      'dry-run': { type: 'boolean', short: 'n' },
    },
    allowPositionals: true,
  });

  if (positionals.length === 0) {
    console.error('Usage: seed:run <glob...> [--orm/-o <path>] [--dry-run/-n]');
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

  const orm = await loadOrm(values.orm);

  try {
    await runSeeders(seeders, { em: orm.em.fork(), logging: true });
  } finally {
    await orm.close();
  }
}
