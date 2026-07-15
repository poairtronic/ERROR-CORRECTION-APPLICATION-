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
import { Decision, ResponsibleParty } from '../common/enums/report-status.enum';

@Entity('inspection_details')
@Index(['responsibleParty', 'responsibleId'])
export class InspectionDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => DefectReport, (r) => r.inspectionDetail)
  @JoinColumn({ name: 'report_id' })
  report: DefectReport;

  @Column({ name: 'report_id' })
  reportId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'inspector_id' })
  inspector: User;

  @Index()
  @Column({ name: 'inspector_id', nullable: true })
  inspectorId: string;

  @Column({ nullable: true })
  errorType: string;

  @Column({ type: 'text', nullable: true })
  rootCause: string;

  @Index()
  @Column({ type: 'simple-enum', enum: ResponsibleParty })
  responsibleParty: ResponsibleParty;

  // operator user id OR vendor id, resolved based on responsibleParty
  @Index()
  @Column({ nullable: true })
  responsibleId: string;

  @Column({ type: 'simple-enum', enum: Decision, nullable: true })
  decision: Decision;

  @Column({ type: 'text', nullable: true })
  alternativeNote: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  costEstimate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, nullable: true })
  materialCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, nullable: true })
  labourCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, nullable: true })
  otherCost: number;

  @Column({ type: 'text', nullable: true })
  costRemarks: string;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0, nullable: true })
  timeEstimateHours: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  lossAmount: number;

  @Column({ type: 'text', nullable: true })
  reworkDescription: string;

  @Column({ name: 'rejection_process_template', type: 'varchar', nullable: true })
  rejectionProcessTemplate?: string;

  @Column({ name: 'rejection_failed_stage', type: 'varchar', nullable: true })
  rejectionFailedStage?: string;

  @Column({ name: 'rejection_stage_costs', type: 'json', nullable: true })
  rejectionStageCosts?: any;

  @Column({ name: 'rejection_description', type: 'text', nullable: true })
  rejectionDescription?: string;

  @CreateDateColumn()
  reviewedAt: Date;
}
