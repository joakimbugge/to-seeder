import { DataSource } from 'typeorm';
import { User } from '../fixtures/user.js';

export function createDataSource(): DataSource {
  return new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    synchronize: true,
    logging: false,
    entities: [User],
  });
}
