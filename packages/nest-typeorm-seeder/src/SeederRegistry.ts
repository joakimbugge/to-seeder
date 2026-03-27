import { Injectable } from '@nestjs/common';
import type { SeederCtor } from './SeederModule.js';

/**
 * Global accumulator of seeder classes collected from `forFeature()` calls.
 * Injected into `SeederRunnerService` to provide the complete list of seeders at boot time.
 */
@Injectable()
export class SeederRegistry {
  private readonly seeders: SeederCtor[] = [];

  /** Adds seeders to the global list. Called by {@link SeederFeatureService} on module init. */
  register(seeders: SeederCtor[]): void {
    this.seeders.push(...seeders);
  }

  /** Returns all registered seeders in the order they were registered. */
  getAll(): SeederCtor[] {
    return this.seeders;
  }
}
