import { Role } from '../common/enums/role.enum';
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
}
