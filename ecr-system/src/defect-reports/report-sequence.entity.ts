import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('report_sequence')
export class ReportSequence {
  @PrimaryColumn()
  id: string;

  @Column({ type: 'int', default: 0 })
  lastValue: number;
}
