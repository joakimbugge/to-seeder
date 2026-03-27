import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { runSeeders } from '@joakimbugge/typeorm-seeder';
import { DataSource } from 'typeorm';
import type { SeederModuleOptions } from './SeederModule.js';

export const SEEDER_MODULE_OPTIONS = Symbol('SEEDER_MODULE_OPTIONS');

const DEFAULT_HISTORY_TABLE = 'seeders';

@Injectable()
export class SeederRunnerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederRunnerService.name);

  constructor(
    @Inject(SEEDER_MODULE_OPTIONS) private readonly options: SeederModuleOptions,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.options.enabled === false) {
      return;
    }

    const dataSource = await this.resolveDataSource();

    if (this.options.seeders) {
      const runOnce = this.options.runOnce ?? true;
      const tableName = this.options.historyTableName ?? DEFAULT_HISTORY_TABLE;

      let executedSeeders = new Set<string>();

      if (runOnce) {
        await this.ensureHistoryTable(dataSource, tableName);
        executedSeeders = await this.getExecutedSeeders(dataSource, tableName);
      }

      await runSeeders(this.options.seeders, {
        dataSource,
        relations: this.options.relations,
        logging: false,
        skip: (seeder) => {
          const shouldSkip = executedSeeders.has(seeder.name);

          if (shouldSkip) {
            this.logger.log(`[${seeder.name}] Skipping (already run)`);
          }

          return shouldSkip;
        },
        onBefore: async (seeder) => {
          this.logger.log(`[${seeder.name}] Starting...`);
          await this.options.onBefore?.(seeder);
        },
        onAfter: async (seeder, durationMs) => {
          if (runOnce) {
            await this.recordRun(dataSource, tableName, seeder.name);
          }

          this.logger.log(`[${seeder.name}] Done in ${durationMs}ms`);
          await this.options.onAfter?.(seeder, durationMs);
        },
        onError: async (seeder, error) => {
          this.logger.error(
            `[${seeder.name}] Failed`,
            error instanceof Error ? error.stack : String(error),
          );
          await this.options.onError?.(seeder, error);
        },
      });
    }

    if (this.options.run) {
      await this.options.run({ dataSource });
    }
  }

  private async ensureHistoryTable(dataSource: DataSource, tableName: string): Promise<void> {
    await dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${tableName}" (name VARCHAR(255) PRIMARY KEY NOT NULL, executed_at VARCHAR(32) NOT NULL)`,
    );
  }

  private async getExecutedSeeders(
    dataSource: DataSource,
    tableName: string,
  ): Promise<Set<string>> {
    const rows: { name: string }[] = await dataSource.query(`SELECT name FROM "${tableName}"`);

    return new Set(rows.map((r) => r.name));
  }

  private async recordRun(dataSource: DataSource, tableName: string, name: string): Promise<void> {
    const executedAt = new Date().toISOString();

    await dataSource.query(
      `INSERT INTO "${tableName}" (name, executed_at) VALUES ('${name}', '${executedAt}')`,
    );
  }

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
