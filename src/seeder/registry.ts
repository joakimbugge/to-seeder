interface SeederMeta {
  dependencies: Function[];
}

const registry = new WeakMap<Function, SeederMeta>();

export function registerSeeder(target: Function, meta: SeederMeta): void {
  registry.set(target, meta);
}

export function getSeederMeta(target: Function): SeederMeta | undefined {
  return registry.get(target);
}
