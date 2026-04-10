import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { MikroORM } from '@mikro-orm/core';

const CONFIG_CANDIDATES = ['mikroorm-seeder.config.ts', 'mikroorm-seeder.config.js'];

async function importOrmFile(filePath: string) {
  const resolved = path.resolve(filePath);
  const mod = await import(pathToFileURL(resolved).href);
  const orm: MikroORM = mod.default ?? mod.orm;

  if (!orm || typeof orm.close !== 'function') {
    throw new Error(
      `No MikroORM instance found in "${filePath}". Export it as the default export or as a named "orm" export.`,
    );
  }

  return orm;
}

/**
 * Resolves the MikroORM instance to use for CLI commands.
 *
 * Resolution order:
 * 1. `filePath` argument (from `--orm` / `-o` flag)
 * 2. `mikroorm-seeder.config.ts` in the current working directory
 * 3. `mikroorm-seeder.config.js` in the current working directory
 *
 * Exits the process with a helpful error message if no MikroORM instance is found.
 */
export async function loadOrm(filePath?: string) {
  if (filePath) {
    if (!existsSync(path.resolve(filePath))) {
      console.error(`Error: MikroORM config file not found: "${filePath}"`);
      process.exit(1);
    }

    return importOrmFile(filePath);
  }

  for (const candidate of CONFIG_CANDIDATES) {
    const candidatePath = path.join(process.cwd(), candidate);

    if (existsSync(candidatePath)) {
      return importOrmFile(candidatePath);
    }
  }

  console.error(
    'Error: No MikroORM instance found.\n' +
      'Pass --orm (-o) with a path to a file that exports a MikroORM instance, or create a\n' +
      '"mikroorm-seeder.config.ts" / "mikroorm-seeder.config.js" in the project root.\n\n' +
      'Example:\n' +
      "  npx @joakimbugge/mikroorm-seeder seed:run './dist/seeders/*.js' -o ./dist/orm.js",
  );

  process.exit(1);
}
