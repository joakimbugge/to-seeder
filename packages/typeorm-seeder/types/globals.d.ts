/**
 * Minimal ambient declarations for Node.js host globals.
 * Keeps `lib` free of DOM while still providing types for runtime globals.
 */
declare var console: {
  log(...data: unknown[]): void
  error(...data: unknown[]): void
  warn(...data: unknown[]): void
  info(...data: unknown[]): void
  debug(...data: unknown[]): void
  trace(...data: unknown[]): void
  dir(obj: unknown, options?: unknown): void
  table(tabularData: unknown, properties?: string[]): void
  time(label?: string): void
  timeEnd(label?: string): void
  timeLog(label?: string, ...data: unknown[]): void
  group(...data: unknown[]): void
  groupCollapsed(...data: unknown[]): void
  groupEnd(): void
  assert(condition?: boolean, ...data: unknown[]): void
  clear(): void
  count(label?: string): void
  countReset(label?: string): void
}
