import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { runSeeders } from '@joakimbugge/mikroorm-seeder';
import { loadSeeders } from '@joakimbugge/seeder';
import { type EntityManager, MikroORM } from '@mikro-orm/core';
import type { SeederModuleOptions } from './SeederModule.js';
import { SeederRegistry } from './SeederRegistry.js';

export const SEEDER_MODULE_OPTIONS = Symbol('SEEDER_MODULE_OPTIONS');

const DEFAULT_HISTORY_TABLE = 'seeders';

/**
 * Drives seeding on every application boot via `onApplicationBootstrap`.
 *
 * Resolves the EntityManager, checks the seeder history table when `runOnce` is enabled,
 * runs all pending seeders in topological order, then executes the inline `run` callback
 * if one was provided.
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

    const em = await this.resolveEntityManager();

    const seeders = await loadSeeders([...(this.options.seeders ?? []), ...this.registry.getAll()]);

    if (seeders.length > 0) {
      const runOnce = this.options.runOnce ?? true;
      const tableName = this.options.historyTableName ?? DEFAULT_HISTORY_TABLE;

      let executedSeeders = new Set<string>();

      if (runOnce) {
        await this.ensureHistoryTable(em, tableName);
        executedSeeders = await this.getExecutedSeeders(em, tableName);
      }

      const logging = this.options.logging !== false;

      await runSeeders(seeders, {
        em,
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
            await this.recordRun(em, tableName, seeder.name);
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
      await this.options.run({ em });
    }
  }

  /**
   * Creates the seeder history table if it does not already exist.
   * The table persists between restarts, allowing `runOnce` to skip seeders
   * that have already been recorded.
   */
  private async ensureHistoryTable(em: EntityManager, tableName: string): Promise<void> {
    await em
      .getConnection()
      .execute(
        `CREATE TABLE IF NOT EXISTS "${tableName}" (name VARCHAR(255) PRIMARY KEY NOT NULL, executed_at VARCHAR(32) NOT NULL)`,
        [],
        'run',
      );
  }

  /** Returns the names of all seeders recorded in the history table. */
  private async getExecutedSeeders(em: EntityManager, tableName: string): Promise<Set<string>> {
    const rows = (await em
      .getConnection()
      .execute(`SELECT name FROM "${tableName}"`, [], 'all')) as { name: string }[];

    return new Set(rows.map((r) => r.name));
  }

  /** Records a successful seeder run in the history table so it is skipped on future boots. */
  private async recordRun(em: EntityManager, tableName: string, name: string): Promise<void> {
    const executedAt = new Date().toISOString();

    await em
      .getConnection()
      .execute(
        `INSERT INTO "${tableName}" (name, executed_at) VALUES ('${name}', '${executedAt}')`,
        [],
        'run',
      );
  }

  /**
   * Resolves the EntityManager to use for seeding.
   * Prefers an explicit `em` from module options; falls back to forking from the
   * MikroORM instance registered in the NestJS container.
   */
  private async resolveEntityManager(): Promise<EntityManager> {
    if (this.options.em) {
      return this.options.em;
    }

    try {
      const orm = this.moduleRef.get(MikroORM, { strict: false });

      return orm.em.fork();
    } catch {
      throw new Error(
        'SeederModule could not resolve a MikroORM instance. Either import MikroOrmModule or provide an em in SeederModule options.',
      );
    }
  }
}
