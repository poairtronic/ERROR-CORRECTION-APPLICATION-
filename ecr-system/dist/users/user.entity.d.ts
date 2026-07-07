import { Role } from '../common/enums/role.enum';
import { NotificationPreference } from '../email/entities/notification-preference.entity';
export declare class User {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
    department: string;
    salaryRefId: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    notificationPreference: NotificationPreference;
}
