import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DataSource } from 'typeorm';

const CONFIG_CANDIDATES = ['typeorm-seeder.config.ts', 'typeorm-seeder.config.js'];

async function importDataSourceFile(filePath: string) {
  const resolved = path.resolve(filePath);
  const mod = await import(pathToFileURL(resolved).href);
  const ds: DataSource = mod.default ?? mod.dataSource;

  if (!ds || typeof ds.initialize !== 'function') {
    throw new Error(
      `No DataSource found in "${filePath}". Export it as the default export or as a named "dataSource" export.`,
    );
  }

  if (!ds.isInitialized) {
    await ds.initialize();
  }

  return ds;
}

/**
 * Resolves the DataSource to use for CLI commands.
 *
 * Resolution order:
 * 1. `filePath` argument (from `--datasource` / `-d` flag)
 * 2. `typeorm-seeder.config.ts` in the current working directory
 * 3. `typeorm-seeder.config.js` in the current working directory
 *
 * Exits the process with a helpful error message if no DataSource is found.
 */
export async function loadDataSource(filePath?: string) {
  if (filePath) {
    if (!existsSync(path.resolve(filePath))) {
      console.error(`Error: DataSource file not found: "${filePath}"`);
      process.exit(1);
    }

    return importDataSourceFile(filePath);
  }

  for (const candidate of CONFIG_CANDIDATES) {
    const candidatePath = path.join(process.cwd(), candidate);

    if (existsSync(candidatePath)) {
      return importDataSourceFile(candidatePath);
    }
  }

  console.error(
    'Error: No DataSource found.\n' +
      'Pass --datasource (-d) with a path to a file that exports a DataSource, or create a\n' +
      '"typeorm-seeder.config.ts" / "typeorm-seeder.config.js" in the project root.\n\n' +
      'Example:\n' +
      "  npx @joakimbugge/typeorm-seeder seed:run './dist/seeders/*.js' -d ./dist/datasource.js",
  );

  process.exit(1);
}
