import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('email_monitoring_audit_logs')
export class EmailMonitoringAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  emailLogId: string;

  @Column()
  adminUserId: string;

  @Column()
  adminUsername: string;

  @Column()
  action: string;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn()
  timestamp: Date;
}
