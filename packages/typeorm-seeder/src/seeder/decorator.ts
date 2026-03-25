import { registerSeeder } from './registry.js';
import type { SeedContext } from '../seed/registry.js';

export interface SeederInterface {
  run(context: SeedContext): Promise<void>;
}

export interface SeederOptions {
  dependencies?: (new () => SeederInterface)[];
}

export function Seeder(options: SeederOptions = {}): ClassDecorator {
  return (target) => {
    registerSeeder(target, { dependencies: options.dependencies ?? [] });
  };
}
