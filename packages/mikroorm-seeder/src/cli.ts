import { printTypeScriptError } from './commands/errors.js';
import { seedEntitiesCommand } from './commands/seedEntities.js';
import { seedListCommand } from './commands/seedList.js';
import { seedRunCommand } from './commands/seedRun.js';
import { seedUntrackCommand } from './commands/seedUntrack.js';

const command = process.argv[2];
const args = process.argv.slice(3);

/**
 * Attempts to register ts-node's ESM loader programmatically so that TypeScript
 * source files can be imported directly without the user needing to invoke Node
 * with `--loader ts-node/esm`.
 *
 * Uses `module.register()` (Node 18.19+) and silently no-ops when:
 * - ts-node is not installed in the user's project
 * - The Node.js version does not support `module.register()`
 */
async function tryLoadReflectMetadata(): Promise<void> {
  try {
    await import('reflect-metadata');
  } catch {
    // optional peer dependency — consumers using ts-morph don't need it
  }
}

async function tryRegisterTypeScript(): Promise<boolean> {
  try {
    const mod: { register?: (spec: string, parentUrl: string) => void } =
      await import('node:module');

    mod.register?.('ts-node/esm', import.meta.url);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  await tryLoadReflectMetadata();
  const tsRegistered = await tryRegisterTypeScript();
  const hasTsArgs = args.some((a) => !a.startsWith('-') && a.includes('.ts'));

  if (!tsRegistered && hasTsArgs) {
    printTypeScriptError(command ?? 'seed:run');
    process.exit(1);
  }

  switch (command) {
    case 'seed:run':
      return seedRunCommand(args);
    case 'seed:entities':
      return seedEntitiesCommand(args);
    case 'seed:list':
      return seedListCommand(args);
    case 'seed:untrack':
      return seedUntrackCommand(args);
    default: {
      const header = command ? `Unknown command: "${command}"\n` : 'No command provided.\n';

      console.error(header);
      console.error('Available commands:');
      console.error('  seed:run        Run @Seeder suites from a glob pattern');
      console.error('  seed:entities   Seed entity instances directly from a glob pattern');
      console.error('  seed:list       List all tracked seeder runs from the history table');
      console.error('  seed:untrack    Remove a seeder from the history table');
      process.exit(1);
    }
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
