/**
 * Recursively walks exported values and collects every function (class constructor)
 * that satisfies the optional `guard`. When no guard is provided every function is collected.
 */
export function collectConstructors<T extends Function>(
  value: unknown,
  out: T[],
  guard: (fn: Function) => boolean = () => true,
): void {
  if (typeof value === 'function') {
    if (guard(value)) {
      out.push(value as T);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectConstructors(item, out, guard);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectConstructors(item, out, guard);
    }
  }
}
