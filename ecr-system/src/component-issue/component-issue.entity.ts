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

interface IssuedComponent {
  componentId: string;
  componentName: string;
  qty: number;
}

@Entity('component_issue')
export class ComponentIssue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DefectReport, (r) => r.componentIssues)
  @JoinColumn({ name: 'report_id' })
  report: DefectReport;

  @Column({ name: 'report_id' })
  reportId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'store_manager_id' })
  storeManager: User;

  @Column({ name: 'store_manager_id', nullable: true })
  storeManagerId: string;

  @Column({ type: 'simple-json' })
  components: IssuedComponent[];

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'issued_to_id' })
  issuedTo: User;

  @Column({ name: 'issued_to_id', nullable: true })
  issuedToId: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  issuedAt: Date;
}
