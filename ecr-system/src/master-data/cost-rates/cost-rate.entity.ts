import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('cost_rates')
export class CostRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  stageName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  ratePerHour: number;

  @Column({ default: true })
  isActive: boolean;
}
