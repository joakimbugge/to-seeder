import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { SeederRegistry } from '../src/SeederRegistry.js';

describe('SeederRegistry', () => {
  it('returns an empty list when nothing has been registered', () => {
    const registry = new SeederRegistry();

    expect(registry.getAll()).toEqual([]);
  });

  it('returns registered seeders', () => {
    const registry = new SeederRegistry();

    class FooSeeder {}

    registry.register([FooSeeder as never]);

    expect(registry.getAll()).toEqual([FooSeeder]);
  });

  it('accumulates seeders across multiple register calls', () => {
    const registry = new SeederRegistry();

    class A {}
    class B {}

    registry.register([A as never]);
    registry.register([B as never]);

    expect(registry.getAll()).toEqual([A, B]);
  });
});
