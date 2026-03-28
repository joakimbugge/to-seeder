import { type DynamicModule, Global, Module } from '@nestjs/common';
import type { RunSeedersOptions, SeederInterface } from '@joakimbugge/typeorm-seeder';
import type { DataSource } from 'typeorm';
import { SeederRunnerService, SEEDER_MODULE_OPTIONS } from './SeederRunnerService.js';
import { SeederRegistry } from './SeederRegistry.js';
import { SeederFeatureService, FEATURE_SEEDERS_TOKEN } from './SeederFeatureService.js';

/** Constructor type for a class decorated with `@Seeder`. */
export type SeederCtor = new () => SeederInterface;

/**
 * Inline callback executed after all seeders have run.
 * Receives the resolved DataSource. Useful for one-off or imperative seeding
 * logic that does not need to be tracked or skipped by `runOnce`.
 */
export type RunCallback = (ctx: { dataSource: DataSource }) => void | Promise<void>;

interface SeederModuleBaseOptions extends Pick<
  RunSeedersOptions,
  'onBefore' | 'onAfter' | 'onError'
> {
  /**
   * Explicit DataSource. When omitted, the module resolves the DataSource
   * registered by `TypeOrmModule`.
   */
  dataSource?: DataSource;
  /** Passed through to `runSeeders`. Set to `false` to skip relation seeding. */
  relations?: boolean;
  /**
   * When `false`, seeding is skipped entirely. Useful for gating on an env var.
   *
   * @default true
   */
  enabled?: boolean;
}

interface SeederModuleSeedersOptions extends SeederModuleBaseOptions {
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
   * When TypeORM's `dropSchema` is `true`, the history table is dropped with the
   * rest of the schema on every start, so all seeders run regardless of this setting.
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

interface SeederModuleRunOptions extends SeederModuleBaseOptions {
  seeders?: never;
  /**
   * Inline callback executed on every boot. runOnce is false.
   */
  run: RunCallback;
  runOnce?: false;
  historyTableName?: never;
}

/** Root module configured with no seeders of its own — all seeders come from `forFeature()`. */
interface SeederModuleFeatureOnlyOptions extends SeederModuleBaseOptions {
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
   * Registers `SeederModule` as a global module at the application root.
   *
   * Seeding runs on `onApplicationBootstrap`, which fires after TypeORM has fully
   * initialized — including schema synchronization and migrations — so no additional
   * waiting or ordering is needed.
   *
   * @example
   * SeederModule.forRoot({ seeders: [PostSeeder] })
   *
   * @example
   * // Gate seeding on an env var
   * SeederModule.forRoot({ seeders: [PostSeeder], enabled: process.env.SEED === 'true' })
   */
  static forRoot(options: SeederModuleOptions): DynamicModule {
    return {
      global: true,
      module: SeederModule,
      providers: [
        { provide: SEEDER_MODULE_OPTIONS, useValue: options },
        SeederRegistry,
        SeederRunnerService,
      ],
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
        SeederRegistry,
        SeederRunnerService,
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
   * Requires `SeederModule.forRoot()` to be imported somewhere in the application.
   *
   * @example
   * // In a feature module:
   * SeederModule.forFeature([PostSeeder])
   */
  static forFeature(seeders: (SeederCtor | string)[]): DynamicModule {
    return {
      module: SeederModule,
      providers: [{ provide: FEATURE_SEEDERS_TOKEN, useValue: seeders }, SeederFeatureService],
    };
  }
}
