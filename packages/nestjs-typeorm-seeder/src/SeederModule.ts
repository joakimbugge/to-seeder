import { type DynamicModule, Module } from '@nestjs/common';
import type { SeederInterface } from '@joakimbugge/typeorm-seeder';
import type { DataSource } from 'typeorm';
import { SeederRunnerService, SEEDER_MODULE_OPTIONS } from './SeederRunnerService.js';

export type SeederCtor = new () => SeederInterface;

export interface SeederModuleOptions {
  seeders: SeederCtor[];
  dataSource?: DataSource;
  relations?: boolean;
}

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
