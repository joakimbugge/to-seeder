import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import {
  Seed,
  seed,
  type SeedContext,
  Seeder,
  type SeederInterface,
} from '@joakimbugge/mikroorm-seeder';
import { faker } from '@faker-js/faker';

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @Seed(() => faker.person.fullName())
  @Property()
  name!: string;
}

@Seeder()
export class UserSeeder implements SeederInterface {
  async run({ em }: SeedContext): Promise<void> {
    await seed(User).save({ em: em! });
  }
}
