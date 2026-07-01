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
import { Decision, ResponsibleParty } from '../common/enums/report-status.enum';

@Entity('inspection_details')
export class InspectionDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => DefectReport, (r) => r.inspectionDetail)
  @JoinColumn({ name: 'report_id' })
  report: DefectReport;

  @Column({ name: 'report_id' })
  reportId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'inspector_id' })
  inspector: User;

  @Column({ name: 'inspector_id' })
  inspectorId: string;

  @Column()
  errorType: string;

  @Column({ type: 'text' })
  rootCause: string;

  @Column({ type: 'enum', enum: ResponsibleParty })
  responsibleParty: ResponsibleParty;

  // operator user id OR vendor id, resolved based on responsibleParty
  @Column({ nullable: true })
  responsibleId: string;

  @Column({ type: 'enum', enum: Decision })
  decision: Decision;

  @Column({ type: 'text', nullable: true })
  alternativeNote: string;

  @CreateDateColumn()
  reviewedAt: Date;
}
