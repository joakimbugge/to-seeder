import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Column, DataSource, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Seed, createManySeed, createSeed } from '../../src';

// ---------------------------------------------------------------------------
// Embedded class — not an entity, just a group of columns with @Seed entries.
// No @Seed is needed on the parent property; the seeder resolves it automatically.
// ---------------------------------------------------------------------------

class Address {
  @Seed(() => faker.location.streetAddress())
  @Column({ type: 'text' })
  street!: string;

  @Seed(() => faker.location.city())
  @Column({ type: 'text' })
  city!: string;

  @Seed(() => faker.location.countryCode())
  @Column({ type: 'text' })
  country!: string;
}

@Entity()
class Customer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.company.name())
  @Column({ type: 'text' })
  name!: string;

  // No @Seed here — the seeder detects this via TypeORM's embedded metadata.
  @Column(() => Address)
  address!: Address;
}

describe('embedded entities', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Customer],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('auto-seeds an embedded class without @Seed on the parent property', async () => {
    const customer = await createSeed(Customer);

    expect(customer.address).toBeDefined();
    expect(typeof customer.address.street).toBe('string');
    expect(typeof customer.address.city).toBe('string');
    expect(typeof customer.address.country).toBe('string');
  });

  it('persists the embedded columns to the database', async () => {
    const repo = dataSource.getRepository(Customer);
    const saved = await repo.save(await createSeed(Customer));
    const fetched = await repo.findOneByOrFail({ id: saved.id });

    expect(fetched.address.street).toBe(saved.address.street);
    expect(fetched.address.city).toBe(saved.address.city);
    expect(fetched.address.country).toBe(saved.address.country);
  });

  it('each seeded instance gets an independently generated address', async () => {
    const repo = dataSource.getRepository(Customer);
    const [a, b] = await repo.save(await createManySeed(Customer, { count: 2 }));

    expect(a.id).not.toBe(b.id);
    expect(a.address).not.toBe(b.address);
  });
});
