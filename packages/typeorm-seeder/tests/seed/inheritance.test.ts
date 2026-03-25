import 'reflect-metadata';
import { faker } from '@faker-js/faker';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ChildEntity,
  Column,
  DataSource,
  Entity,
  PrimaryGeneratedColumn,
  TableInheritance,
} from 'typeorm';
import { Seed, createSeed } from '../../src';

@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
class Vehicle {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.vehicle.manufacturer())
  @Column({ type: 'text' })
  make!: string;

  @Seed(() => faker.vehicle.model())
  @Column({ type: 'text' })
  model!: string;
}

@ChildEntity()
class Car extends Vehicle {
  @Seed(() => faker.number.int({ min: 2, max: 6 }))
  @Column({ type: 'integer' })
  doors!: number;
}

@ChildEntity()
class Truck extends Vehicle {
  @Seed(() => faker.number.float({ min: 0.5, max: 5.0, fractionDigits: 1 }))
  @Column({ type: 'real' })
  payloadTons!: number;
}

describe('entity inheritance', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Vehicle, Car, Truck],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('seeds inherited parent properties alongside child properties', async () => {
    const car = await createSeed(Car);

    expect(typeof car.make).toBe('string');
    expect(typeof car.model).toBe('string');
    expect(typeof car.doors).toBe('number');
    expect(car.doors).toBeGreaterThanOrEqual(2);
  });

  it('persists a child entity including inherited columns', async () => {
    const car = await dataSource.getRepository(Vehicle).save(await createSeed(Car));

    expect(car.id).toBeGreaterThan(0);
    expect(typeof car.make).toBe('string');
    expect(typeof (car as Car).doors).toBe('number');
  });

  it('different child types share the same table but seed independently', async () => {
    const repo = dataSource.getRepository(Vehicle);
    const car = await repo.save(await createSeed(Car));
    const truck = await repo.save(await createSeed(Truck));

    const all = await repo.find();
    const ids = all.map((v) => v.id);
    expect(ids).toContain(car.id);
    expect(ids).toContain(truck.id);
  });

  it('child-only properties are not present on sibling child instances', async () => {
    const car = await createSeed(Car);
    const truck = await createSeed(Truck);

    expect((car as unknown as Truck).payloadTons).toBeUndefined();
    expect((truck as unknown as Car).doors).toBeUndefined();
  });
});
