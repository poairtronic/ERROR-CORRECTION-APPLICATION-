import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { User } from '../users/user.entity';

@Entity('gm_approval')
export class GmApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => DefectReport, (r) => r.gmApproval)
  @JoinColumn({ name: 'report_id' })
  report: DefectReport;

  @Column({ name: 'report_id' })
  reportId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'gm_id' })
  generalManager: User;

  @Index()
  @Column({ name: 'gm_id', nullable: true })
  gmId: string;

  @Column()
  approved: boolean;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'text', nullable: true })
  messageToSm?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  budgetApproved: number;

  @CreateDateColumn()
  approvedAt: Date;
}
