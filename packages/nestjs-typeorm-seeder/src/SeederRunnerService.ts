import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { runSeeders } from '@joakimbugge/typeorm-seeder';
import { DataSource } from 'typeorm';
import type { SeederModuleOptions } from './SeederModule.js';

export const SEEDER_MODULE_OPTIONS = Symbol('SEEDER_MODULE_OPTIONS');

@Injectable()
export class SeederRunnerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederRunnerService.name);

  constructor(
    @Inject(SEEDER_MODULE_OPTIONS) private readonly options: SeederModuleOptions,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const dataSource = await this.resolveDataSource();

    await runSeeders(this.options.seeders, {
      dataSource,
      relations: this.options.relations,
      logging: false,
      onBefore: (seeder) => this.logger.log(`[${seeder.name}] Starting...`),
      onAfter: (seeder, durationMs) => this.logger.log(`[${seeder.name}] Done in ${durationMs}ms`),
      onError: (seeder, error) =>
        this.logger.error(
          `[${seeder.name}] Failed`,
          error instanceof Error ? error.stack : String(error),
        ),
    });
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
