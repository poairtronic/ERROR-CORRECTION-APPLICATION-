import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('error_types')
export class ErrorType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;
}
