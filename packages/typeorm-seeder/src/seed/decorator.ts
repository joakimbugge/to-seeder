import { registerSeed } from './registry.js';
import type { SeedFactory, SeedOptions } from './registry.js';

/** Mark a relation property for auto-seeding (creates one related entity). */
export function Seed(): PropertyDecorator;
/** Mark a relation property for auto-seeding with options (e.g. count for one-to-many). */
export function Seed(options: SeedOptions): PropertyDecorator;
/** Mark a scalar property with a factory callback. */
export function Seed(factory: SeedFactory): PropertyDecorator;
/** Mark a scalar property with a factory callback and options. */
export function Seed(factory: SeedFactory, options: SeedOptions): PropertyDecorator;
export function Seed(
  factoryOrOptions?: SeedFactory | SeedOptions,
  options?: SeedOptions,
): PropertyDecorator {
  const factory = typeof factoryOrOptions === 'function' ? factoryOrOptions : undefined;
  const opts: SeedOptions =
    (typeof factoryOrOptions === 'object' ? factoryOrOptions : options) ?? {};

  return (target, propertyKey) => {
    registerSeed(target.constructor as Function, { propertyKey, factory, options: opts });
  };
}
