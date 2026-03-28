import 'reflect-metadata';
import { Seeder } from '../../../src/index.js';
import type { SeederInterface, SeedContext } from '../../../src/index.js';

@Seeder()
export class FixtureBookSeeder implements SeederInterface {
  async run(_ctx: SeedContext): Promise<void> {}
}
