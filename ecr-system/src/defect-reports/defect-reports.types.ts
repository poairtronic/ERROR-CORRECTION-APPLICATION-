import { Role } from '../common/enums/role.enum';

export interface ActingUser {
  id: string | null | any;
  role: Role;
  username?: string;
  name?: string;
}
