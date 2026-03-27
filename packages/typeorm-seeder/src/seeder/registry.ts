interface SeederMeta {
  dependencies: Function[];
}

const registry = new WeakMap<Function, SeederMeta>();

/** Registers seeder metadata for the given class constructor. Called internally by the `@Seeder` decorator. */
export function registerSeeder(target: Function, meta: SeederMeta): void {
  registry.set(target, meta);
}

/** Returns the metadata registered for the given seeder class, or `undefined` if not registered. */
export function getSeederMeta(target: Function): SeederMeta | undefined {
  return registry.get(target);
}
