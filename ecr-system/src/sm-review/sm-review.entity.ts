import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { User } from '../users/user.entity';

@Entity('sm_review')
export class SmReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => DefectReport, (r) => r.smReview)
  @JoinColumn({ name: 'report_id' })
  report: DefectReport;

  @Column({ name: 'report_id' })
  reportId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sm_id' })
  seniorManager: User;

  @Column({ name: 'sm_id' })
  smId: string;

  @Column({ type: 'text' })
  loopholeNote: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  costEstimate: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  timeEstimateHours: number;

  // populated if decision trends toward SCRAP
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  lossAmount: number;

  @Column({ type: 'text' })
  decisionNote: string;

  @Column({ default: false })
  biasedFlag: boolean;

  @Column({ default: false })
  forwardedToGm: boolean;

  @CreateDateColumn()
  reviewedAt: Date;
}
