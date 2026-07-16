import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  Index,
} from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { NotificationPreference } from '../email/entities/notification-preference.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Index()
  @Column({ type: 'simple-enum', enum: Role })
  role: Role;

  @Column({ nullable: true })
  department: string;

  // links to payroll record for salary deduction lookups
  @Index()
  @Column({ nullable: true })
  salaryRefId: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => NotificationPreference, (pref) => pref.user, { cascade: true })
  notificationPreference: NotificationPreference;
}
