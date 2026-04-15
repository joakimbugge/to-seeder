import { type DynamicModule, Global, Module } from '@nestjs/common';
import type { RunSeedersOptions, SeederInterface } from '@joakimbugge/mikroorm-seeder';
import type { EntityManager } from '@mikro-orm/core';
import { SeederRunnerService, SEEDER_MODULE_OPTIONS } from './SeederRunnerService.js';
import { SeederRegistry } from './SeederRegistry.js';
import { SeederFeatureService, FEATURE_SEEDERS_TOKEN } from './SeederFeatureService.js';

/** Constructor type for a class decorated with `@Seeder`. */
export type SeederCtor = new () => SeederInterface;

/**
 * Inline callback executed after all seeders have run.
 * Receives the resolved EntityManager.
 */
export type RunCallback = (ctx: { em: EntityManager }) => void | Promise<void>;

interface SeederModuleBaseOptions extends Pick<
  RunSeedersOptions,
  'onBefore' | 'onSuccess' | 'onError' | 'onFinally'
> {
  /**
   * Explicit EntityManager. When omitted, the module resolves MikroORM from
   * the NestJS container and forks a fresh EntityManager.
   */
  em?: EntityManager;
  /** Passed through to `runSeeders`. Set to `false` to skip relation seeding. */
  relations?: boolean;
  /**
   * When `false`, seeding is skipped entirely. Useful for gating on an env var.
   *
   * @default true
   */
  enabled?: boolean;
  /**
   * When `false`, suppresses all seeder progress output. When `true` (default),
   * logs via NestJS's own `Logger` — output follows NestJS's logging configuration.
   *
   * @default true
   */
  logging?: boolean;
}

export interface SeederModuleSeedersOptions extends SeederModuleBaseOptions {
  /** Seeder classes or glob patterns resolving to seeder files. Transitive dependencies are resolved automatically. */
  seeders: (SeederCtor | string)[];
  /**
   * Inline callback executed after all seeders have run. Always executes on
   * every boot — `runOnce` does not apply to it.
   */
  run?: RunCallback;
  /**
   * Track executed seeders in a database table and skip them on subsequent boots.
   * Set to `false` to always run every seeder regardless.
   *
   * @default true
   */
  runOnce?: boolean;
  /**
   * Name of the table used to track which seeders have run.
   *
   * @default 'seeders'
   */
  historyTableName?: string;
}

export interface SeederModuleRunOptions extends SeederModuleBaseOptions {
  seeders?: never;
  /**
   * Inline callback executed on every boot. runOnce is false.
   */
  run: RunCallback;
  runOnce?: false;
  historyTableName?: never;
}

/** Root module configured with no seeders of its own — all seeders come from `forFeature()`. */
export interface SeederModuleFeatureOnlyOptions extends SeederModuleBaseOptions {
  seeders?: never;
  run?: never;
  runOnce?: boolean;
  historyTableName?: string;
}

/**
 * Options for {@link SeederModule.forRoot} and {@link SeederModule.forRootAsync}.
 *
 * Three shapes are supported:
 * - **Seeders** — pass `seeders` to use `@Seeder` classes with optional `runOnce` tracking.
 * - **Run-only** — pass only `run` for a simple inline callback executed on every boot.
 * - **Feature-only** — omit both; all seeders are registered via `SeederModule.forFeature()`.
 */
export type SeederModuleOptions =
  | SeederModuleSeedersOptions
  | SeederModuleRunOptions
  | SeederModuleFeatureOnlyOptions;

/**
 * Async factory variant of {@link SeederModuleOptions}.
 * Use when options depend on injected providers such as `ConfigService`.
 *
 * @example
 * SeederModule.forRootAsync({
 *   imports: [ConfigModule],
 *   inject: [ConfigService],
 *   useFactory: (config: ConfigService) => ({
 *     seeders: [PostSeeder],
 *     enabled: config.get('SEED') === 'true',
 *   }),
 * })
 */
export interface SeederModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => SeederModuleOptions | Promise<SeederModuleOptions>;
}

/**
 * Internal host module for `forFeature()` registrations. Using a separate class
 * ensures that `forFeature()` dynamic modules do not inherit `SeederModule`'s
 * static providers (in particular `SeederRunnerService`), which would cause a
 * second runner instance to bootstrap with empty options.
 */
@Module({})
class SeederFeatureModule {}

/**
 * Seeder module. Import at the application root to activate seeding.
 *
 * When imported as a bare class (`SeederModule`) all configuration uses defaults —
 * no root seeders, `runOnce` enabled, MikroORM auto-resolved from the NestJS container.
 * Use {@link forRoot} when you need to customise any of those options.
 */
@Global()
@Module({
  providers: [
    { provide: SEEDER_MODULE_OPTIONS, useValue: {} },
    SeederRegistry,
    SeederRunnerService,
  ],
  exports: [SeederRegistry],
})
export class SeederModule {
  /**
   * Configures `SeederModule` at the application root with explicit options.
   *
   * Seeding runs on `onApplicationBootstrap`, which fires after MikroORM has fully
   * initialized — so no additional waiting or ordering is needed.
   *
   * Omit `options` (or omit both `seeders` and `run`) when all seeders are registered
   * via `forFeature()`.
   *
   * @example
   * SeederModule.forRoot({ seeders: [PostSeeder] })
   *
   * @example
   * // Gate seeding on an env var
   * SeederModule.forRoot({ seeders: [PostSeeder], enabled: process.env.SEED === 'true' })
   */
  static forRoot(options: SeederModuleOptions = {}): DynamicModule {
    return {
      global: true,
      module: SeederModule,
      providers: [{ provide: SEEDER_MODULE_OPTIONS, useValue: options }],
      exports: [SeederRegistry],
    };
  }

  /**
   * Async variant of {@link forRoot}. Use when options depend on injected providers.
   *
   * @example
   * SeederModule.forRootAsync({
   *   imports: [ConfigModule],
   *   inject: [ConfigService],
   *   useFactory: (config: ConfigService) => ({
   *     seeders: [PostSeeder],
   *     enabled: config.get('SEED') === 'true',
   *   }),
   * })
   */
  static forRootAsync(options: SeederModuleAsyncOptions): DynamicModule {
    return {
      global: true,
      module: SeederModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: SEEDER_MODULE_OPTIONS,
          inject: options.inject ?? [],
          useFactory: options.useFactory,
        },
      ],
      exports: [SeederRegistry],
    };
  }

  /**
   * Registers seeders from a feature module into the global seeder list.
   *
   * Use this to co-locate seeders with the feature module they belong to rather than
   * listing everything in the root module. The seeders are merged with any declared in
   * `forRoot` and run together on bootstrap.
   *
   * Requires `SeederModule` or `SeederModule.forRoot()` to be imported somewhere in the application.
   *
   * @example
   * // In a feature module:
   * SeederModule.forFeature([PostSeeder])
   */
  static forFeature(seeders: (SeederCtor | string)[]): DynamicModule {
    return {
      module: SeederFeatureModule,
      providers: [{ provide: FEATURE_SEEDERS_TOKEN, useValue: seeders }, SeederFeatureService],
    };
  }
}
