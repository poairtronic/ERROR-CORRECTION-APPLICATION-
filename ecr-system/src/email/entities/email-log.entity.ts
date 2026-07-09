import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmailStatus } from '../enums/email-status.enum';
import { NotificationEvent } from '../enums/notification-event.enum';

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recipient: string;

  @Column({ nullable: true })
  cc: string;

  @Column({ nullable: true })
  bcc: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'boolean', default: true })
  isHtml: boolean;

  @Column({
    type: 'simple-enum',
    enum: NotificationEvent,
  })
  event: NotificationEvent;

  @Column({
    type: 'simple-enum',
    enum: EmailStatus,
    default: EmailStatus.PENDING,
  })
  status: EmailStatus;

  @Column({ nullable: true })
  sentTime: Date;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ nullable: true })
  relatedReportId: string;

  @Column({ nullable: true })
  notificationId: string;

  @Column({ nullable: true })
  providerMessageId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
