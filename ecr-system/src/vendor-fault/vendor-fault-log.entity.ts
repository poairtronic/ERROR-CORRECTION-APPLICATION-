import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { Vendor } from '../master-data/vendors/vendor.entity';
import { RecoveryStatus } from '../common/enums/report-status.enum';

@Entity('vendor_fault_log')
export class VendorFaultLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DefectReport)
  @JoinColumn({ name: 'report_id' })
  report: DefectReport;

  @Index()
  @Column({ name: 'report_id' })
  reportId: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Index()
  @Column({ name: 'vendor_id' })
  vendorId: string;

  @Column({ type: 'text' })
  note: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  recoveryAmount: number;

  @Index()
  @Column({
    type: 'simple-enum',
    enum: RecoveryStatus,
    default: RecoveryStatus.PENDING,
  })
  recoveryStatus: RecoveryStatus;

  @CreateDateColumn()
  raisedAt: Date;

  @Column({ nullable: true })
  recoveredAt: Date;
}
