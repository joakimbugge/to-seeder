import 'reflect-metadata';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Seed } from '../../../src/index.js';

@Entity()
export class FixtureAuthor {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => 'fixture-author')
  @Column({ type: 'text' })
  name!: string;
}
