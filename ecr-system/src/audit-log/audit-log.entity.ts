import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { User } from '../users/user.entity';

export enum AuditActionType {
  STATUS_CHANGE = 'STATUS_CHANGE',
  FIELD_EDIT = 'FIELD_EDIT',
  INVENTORY_UPDATED = 'INVENTORY_UPDATED',
  COMPONENT_ISSUED = 'COMPONENT_ISSUED',
  SALARY_DEDUCTION_CREATED = 'SALARY_DEDUCTION_CREATED',
  VENDOR_FAULT_CREATED = 'VENDOR_FAULT_CREATED',
  IMAGE_UPLOADED = 'IMAGE_UPLOADED',
}

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DefectReport)
  @JoinColumn({ name: 'report_id' })
  report: DefectReport;

  @Column({ name: 'report_id' })
  reportId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor: User;

  @Column({ name: 'actor_id', nullable: true })
  actorId: string;

  @Column()
  actorRole: string;

  @Column({ type: 'simple-enum', enum: AuditActionType })
  actionType: AuditActionType;

  @Column({ nullable: true })
  fieldName: string;

  @Column({ type: 'text', nullable: true })
  oldValue: string;

  @Column({ type: 'text', nullable: true })
  newValue: string;

  @Column({ nullable: true })
  fromStatus: string;

  @Column({ nullable: true })
  toStatus: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  timestamp: Date;
}
