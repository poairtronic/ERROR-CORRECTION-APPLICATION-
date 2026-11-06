import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyResetTokenDto {
  @IsNotEmpty({ message: 'Token is required' })
  @IsString()
  token: string;
}

