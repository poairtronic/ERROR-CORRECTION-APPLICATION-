import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class MaterialIssuedDto {
  @IsNotEmpty()
  @IsString()
  ecrId: string;

  @IsNotEmpty()
  @IsString()
  reportNumber: string;

  @IsNotEmpty()
  @IsString()
  issuedAt: string;

  @IsNumber()
  @IsPositive()
  issuedQty: number;

  @IsNotEmpty()
  @IsString()
  stockTransactionId: string;

  @IsNotEmpty()
  @IsString()
  issuedByName: string;
}

