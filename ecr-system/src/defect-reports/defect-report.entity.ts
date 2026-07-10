import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { ReportStatus, RaisedByRole } from '../common/enums/report-status.enum';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { ComponentIssue } from '../component-issue/component-issue.entity';
import { AuditLog } from '../audit-log/audit-log.entity';

@Entity('defect_reports')
export class DefectReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // human-readable: AGIPL-2026-ERR-00001, generated in service on create
  @Column({ unique: true, nullable: true })
  reportNumber: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'raised_by_id' })
  raisedBy: User;

  @Index()
  @Column({ name: 'raised_by_id', nullable: true })
  raisedById: string;

  @Column({ type: 'simple-enum', enum: RaisedByRole })
  raisedByRole: RaisedByRole;

  @Index()
  @Column()
  scOrPoNo: string;

  @Column({ nullable: true })
  productId: string;

  @Column({ nullable: true })
  componentName: string;

  @Column({ nullable: true })
  errorTypeName: string;

  @Column({ nullable: true })
  partNumber: string;

  @Column({ nullable: true })
  batchNumber: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column()
  stageOfFailure: string;

  @Column({ type: 'text' })
  defectDescription: string;

  // array of image URLs (Cloudinary free tier or local disk path)
  @Column({ type: 'simple-json', default: '[]' })
  images: string[];

  @Index()
  @Column({ type: 'simple-enum', enum: ReportStatus, default: ReportStatus.DRAFT })
  status: ReportStatus;

  @Column({ type: 'varchar', nullable: true })
  inspectionType: string | null;  // 'REWORK' | 'REJECTION' — null for legacy reports

  @OneToOne(() => InspectionDetail, (i) => i.report, { nullable: true })
  inspectionDetail: InspectionDetail;

  @OneToOne(() => SmReview, (s) => s.report, { nullable: true })
  smReview: SmReview;

  @OneToOne(() => GmApproval, (g) => g.report, { nullable: true })
  gmApproval: GmApproval;

  @OneToMany(() => ComponentIssue, (c) => c.report)
  componentIssues: ComponentIssue[];

  @OneToMany(() => AuditLog, (log) => log.report)
  auditLogs: AuditLog[];

  @Column({ default: false })
  componentsIssued: boolean;

  @Column({ nullable: true })
  componentsIssuedById: string;

  @Column({ type: 'timestamp', nullable: true })
  componentsIssuedAt: Date;

  @Column({ type: 'text', nullable: true })
  issueRemarks: string;

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @Index()
  @UpdateDateColumn()
  updatedAt: Date;
}
