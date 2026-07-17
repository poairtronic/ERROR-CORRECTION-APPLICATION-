import { Role } from '../common/enums/role.enum';

export interface ActingUser {
  id: string;
  role: Role;
  username?: string;
}
