import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
  Seed,
  seed,
  type SeedContext,
  Seeder,
  type SeederInterface,
} from '@joakimbugge/typeorm-seeder';
import { faker } from '@faker-js/faker';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Column()
  name!: string;
}

@Seeder()
export class UserSeeder implements SeederInterface {
  async run({ dataSource }: SeedContext): Promise<void> {
    await seed(User).save({ dataSource: dataSource! });
  }
}
