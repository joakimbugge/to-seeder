import { describe, expect, it } from 'vitest';
import { runSeeders } from '../../src';
import { registerSeeder } from '../../src/seeder/registry.js';

// The `throw err` re-throw branch at the end of sortSeeders() is not tested.
// It fires only when dependency-graph throws an error that lacks a `cyclePath` property,
// which never happens in practice — the library exclusively throws cyclePath errors.
describe('circular dependencies', () => {
  it('throws when a cycle is detected', async () => {
    class CycleA {
      async run() {}
    }

    class CycleB {
      async run() {}
    }

    registerSeeder(CycleA, { dependencies: [CycleB] });
    registerSeeder(CycleB, { dependencies: [CycleA] });

    await expect(runSeeders([CycleA], {})).rejects.toThrow('Circular dependency');
  });

  it('names the offending seeders in the error message', async () => {
    class LoopX {
      async run() {}
    }

    class LoopY {
      async run() {}
    }

    registerSeeder(LoopX, { dependencies: [LoopY] });
    registerSeeder(LoopY, { dependencies: [LoopX] });

    await expect(runSeeders([LoopX], {})).rejects.toThrow(/LoopX|LoopY/);
  });
});
