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
import { User } from '../users/user.entity';

@Entity('report_attachments')
export class ReportAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_report_attachments_report_id')
  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @ManyToOne(() => DefectReport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: DefectReport;

  @Column({ name: 'file_name', length: 255 })
  fileName: string;

  @Column({ name: 'original_name', length: 255 })
  originalName: string;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl: string;

  @Column({ name: 'public_id', length: 500 })
  publicId: string;

  @Column({ name: 'file_type', length: 50 })
  fileType: string; // 'image', 'pdf', 'document'

  @Column({ name: 'mime_type', length: 100 })
  mimeType: string;

  @Column({ name: 'file_size_bytes', type: 'int', nullable: true })
  fileSizeBytes: number | null;

  @Column({ name: 'uploaded_by_id', type: 'uuid', nullable: true })
  uploadedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User | null;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
