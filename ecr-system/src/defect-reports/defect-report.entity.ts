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
} from 'typeorm';
import { User } from '../users/user.entity';
import { ReportStatus, RaisedByRole } from '../common/enums/report-status.enum';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { ComponentIssue } from '../component-issue/component-issue.entity';

@Entity('defect_reports')
export class DefectReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // human-readable: DR-2026-00001, generated in service on create
  @Column({ unique: true })
  reportNo: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'raised_by_id' })
  raisedBy: User;

  @Column({ name: 'raised_by_id' })
  raisedById: string;

  @Column({ type: 'simple-enum', enum: RaisedByRole })
  raisedByRole: RaisedByRole;

  // free-text reference to SC/PO number - one order can have multiple defect reports
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

  @Column({ type: 'simple-enum', enum: ReportStatus, default: ReportStatus.DRAFT })
  status: ReportStatus;

  @OneToOne(() => InspectionDetail, (i) => i.report, { nullable: true })
  inspectionDetail: InspectionDetail;

  @OneToOne(() => SmReview, (s) => s.report, { nullable: true })
  smReview: SmReview;

  @OneToOne(() => GmApproval, (g) => g.report, { nullable: true })
  gmApproval: GmApproval;

  @OneToMany(() => ComponentIssue, (c) => c.report)
  componentIssues: ComponentIssue[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
