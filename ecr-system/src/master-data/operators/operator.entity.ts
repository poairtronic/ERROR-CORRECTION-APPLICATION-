import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('operators')
export class Operator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  operatorCode: string;

  @Column({ default: true })
  isActive: boolean;
}
