import 'reflect-metadata';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Seed } from '../../../src/index.js';

@Entity()
export class FixtureBook {
  @PrimaryGeneratedColumn()
  id!: number;

  @Seed(() => 'fixture-book')
  @Column({ type: 'text' })
  title!: string;
}
