import { Role } from '../../common/enums/role.enum';
export declare class UpdateUserDto {
    name?: string;
    role?: Role;
    department?: string;
    isActive?: boolean;
}
