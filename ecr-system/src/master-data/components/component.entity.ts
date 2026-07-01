import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('components')
export class Component {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ default: 0 })
  stockQty: number;

  @Column({ nullable: true })
  unit: string;

  @Column({ default: true })
  isActive: boolean;
}
