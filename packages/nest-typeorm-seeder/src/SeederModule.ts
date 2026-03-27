import { type DynamicModule, Module } from '@nestjs/common';
import type { RunSeedersOptions, SeederInterface } from '@joakimbugge/typeorm-seeder';
import type { DataSource } from 'typeorm';
import { SeederRunnerService, SEEDER_MODULE_OPTIONS } from './SeederRunnerService.js';

export type SeederCtor = new () => SeederInterface;

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
  /** Seeder classes to run. Transitive dependencies are resolved automatically. */
  seeders: SeederCtor[];
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

export type SeederModuleOptions = SeederModuleSeedersOptions | SeederModuleRunOptions;

export interface SeederModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => SeederModuleOptions | Promise<SeederModuleOptions>;
}

@Module({})
export class SeederModule {
  static forRoot(options: SeederModuleOptions): DynamicModule {
    return {
      module: SeederModule,
      providers: [{ provide: SEEDER_MODULE_OPTIONS, useValue: options }, SeederRunnerService],
    };
  }

  static forRootAsync(options: SeederModuleAsyncOptions): DynamicModule {
    return {
      module: SeederModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: SEEDER_MODULE_OPTIONS,
          inject: options.inject ?? [],
          useFactory: options.useFactory,
        },
        SeederRunnerService,
      ],
    };
  }
}
