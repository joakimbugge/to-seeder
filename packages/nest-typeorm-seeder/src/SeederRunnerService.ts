import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { loadSeeders, runSeeders } from '@joakimbugge/typeorm-seeder';
import { DataSource } from 'typeorm';
import type { SeederModuleOptions } from './SeederModule.js';
import { SeederRegistry } from './SeederRegistry.js';

export const SEEDER_MODULE_OPTIONS = Symbol('SEEDER_MODULE_OPTIONS');

const DEFAULT_HISTORY_TABLE = 'seeders';

/**
 * Drives seeding on every application boot via `onApplicationBootstrap`.
 *
 * Resolves the DataSource, checks the seeder history table when `runOnce` is enabled,
 * runs all pending seeders in topological order, then executes the inline `run` callback
 * if one was provided.
 *
 * TypeORM schema synchronization and migrations are guaranteed to have completed before
 * this hook fires, so it is safe to read and write to the database here.
 */
@Injectable()
export class SeederRunnerService implements OnApplicationBootstrap {
  private readonly logger = new Logger('SeederModule');

  constructor(
    @Inject(SEEDER_MODULE_OPTIONS) private readonly options: SeederModuleOptions,
    private readonly moduleRef: ModuleRef,
    private readonly registry: SeederRegistry,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.options.enabled === false) {
      return;
    }

    const dataSource = await this.resolveDataSource();

    const seeders = await loadSeeders([...(this.options.seeders ?? []), ...this.registry.getAll()]);

    if (seeders.length > 0) {
      const runOnce = this.options.runOnce ?? true;
      const tableName = this.options.historyTableName ?? DEFAULT_HISTORY_TABLE;

      let executedSeeders = new Set<string>();

      if (runOnce) {
        await this.ensureHistoryTable(dataSource, tableName);
        executedSeeders = await this.getExecutedSeeders(dataSource, tableName);
      }

      const logging = this.options.logging !== false;

      await runSeeders(seeders, {
        dataSource,
        relations: this.options.relations,
        logging: false,
        skip: (seeder) => {
          const shouldSkip = executedSeeders.has(seeder.name);

          if (shouldSkip && logging) {
            this.logger.log(`[${seeder.name}] Skipping (already run)`);
          }

          return shouldSkip;
        },
        onBefore: async (seeder) => {
          if (logging) {
            this.logger.log(`[${seeder.name}] Starting...`);
          }

          await this.options.onBefore?.(seeder);
        },
        onAfter: async (seeder, durationMs) => {
          if (runOnce) {
            await this.recordRun(dataSource, tableName, seeder.name);
          }

          if (logging) {
            this.logger.log(`[${seeder.name}] Done in ${durationMs}ms`);
          }

          await this.options.onAfter?.(seeder, durationMs);
        },
        onError: async (seeder, error) => {
          if (logging) {
            this.logger.error(
              `[${seeder.name}] Failed`,
              error instanceof Error ? error.stack : String(error),
            );
          }

          await this.options.onError?.(seeder, error);
        },
      });
    }

    if (this.options.run) {
      await this.options.run({ dataSource });
    }
  }

  /**
   * Creates the seeder history table if it does not already exist.
   * The table persists between restarts when TypeORM's `dropSchema` is false,
   * allowing `runOnce` to skip seeders that have already been recorded.
   * When `dropSchema` is true the table is dropped with the rest of the schema on every
   * start, so all seeders run fresh — which is the expected behaviour in that case.
   */
  private async ensureHistoryTable(dataSource: DataSource, tableName: string): Promise<void> {
    await dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${tableName}" (name VARCHAR(255) PRIMARY KEY NOT NULL, executed_at VARCHAR(32) NOT NULL)`,
    );
  }

  /** Returns the names of all seeders recorded in the history table. */
  private async getExecutedSeeders(
    dataSource: DataSource,
    tableName: string,
  ): Promise<Set<string>> {
    const rows: { name: string }[] = await dataSource.query(`SELECT name FROM "${tableName}"`);

    return new Set(rows.map((r) => r.name));
  }

  /** Records a successful seeder run in the history table so it is skipped on future boots. */
  private async recordRun(dataSource: DataSource, tableName: string, name: string): Promise<void> {
    const executedAt = new Date().toISOString();

    await dataSource.query(
      `INSERT INTO "${tableName}" (name, executed_at) VALUES ('${name}', '${executedAt}')`,
    );
  }

  /**
   * Resolves the DataSource to use for seeding.
   * Prefers an explicit `dataSource` from module options; falls back to the DataSource
   * registered in the NestJS container by `TypeOrmModule`.
   *
   * If a raw, uninitialized DataSource is passed directly via options, the caller is
   * responsible for calling `dataSource.initialize()` before the application starts.
   */
  private async resolveDataSource(): Promise<DataSource> {
    if (this.options.dataSource) {
      return this.options.dataSource;
    }

    try {
      return this.moduleRef.get(DataSource, { strict: false });
    } catch {
      throw new Error(
        'SeederModule could not resolve a DataSource. Either import TypeOrmModule or provide a dataSource in SeederModule options.',
      );
    }
  }
}
