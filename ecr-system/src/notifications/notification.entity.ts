import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import {
  NotificationChannel,
  NotificationStatus,
} from '../common/enums/report-status.enum';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => DefectReport, { nullable: true })
  @JoinColumn({ name: 'report_id' })
  report: DefectReport;

  @Index()
  @Column({ name: 'report_id', nullable: true })
  reportId: string;

  @Column({ type: 'simple-enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column()
  type: string; // e.g. NEW_DEFECT, PENDING_SM_REVIEW, GM_APPROVED, SALARY_DEDUCTED

  @Column({ type: 'text' })
  message: string;

  @Index()
  @Column({ default: false })
  read: boolean;

  @Column({
    type: 'simple-enum',
    enum: NotificationStatus,
    default: NotificationStatus.QUEUED,
  })
  status: NotificationStatus;

  @Column({ default: 0 })
  attemptCount: number;

  @Column({ nullable: true })
  sentAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
