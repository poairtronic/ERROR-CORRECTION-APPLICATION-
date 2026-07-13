import { IsEmail, IsEnum, IsNotEmpty, IsOptional, MinLength, IsString } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  salaryRefId?: string;

  @MinLength(6)
  @IsString()
  tempPassword: string;
}
