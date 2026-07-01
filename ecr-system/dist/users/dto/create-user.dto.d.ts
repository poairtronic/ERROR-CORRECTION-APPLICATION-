import { Role } from '../../common/enums/role.enum';
export declare class CreateUserDto {
    name: string;
    email: string;
    role: Role;
    department?: string;
    salaryRefId?: string;
    tempPassword: string;
}
