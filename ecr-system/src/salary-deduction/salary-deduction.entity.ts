import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { User } from '../users/user.entity';

@Entity('salary_deduction')
export class SalaryDeduction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DefectReport)
  @JoinColumn({ name: 'report_id' })
  report: DefectReport;

  @Index()
  @Column({ name: 'report_id' })
  reportId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'operator_id' })
  operator: User;

  @Index()
  @Column({ name: 'operator_id', nullable: true })
  operatorId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Index()
  @Column({ default: 'PENDING' })
  status: string; // PENDING, APPROVED, CANCELLED, PAID

  @Column({ type: 'text', nullable: true })
  reason: string;

  // e.g. "2026-07" - which payroll month this applies to
  @Column()
  monthRef: string;

  @CreateDateColumn()
  createdAt: Date;
}
