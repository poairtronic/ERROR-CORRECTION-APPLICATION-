import { IsArray, IsNotEmpty, IsNumber, IsString, Min, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class IssuedComponentDto {
  @IsString()
  @IsNotEmpty()
  componentId: string;

  @IsString()
  @IsNotEmpty()
  componentName: string;

  @IsNumber()
  @Min(1)
  qty: number;
}

export class CreateComponentIssueDto {
  @IsString()
  @IsNotEmpty()
  reportId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssuedComponentDto)
  components: IssuedComponentDto[];

  @IsString()
  @IsNotEmpty()
  issuedToId: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}
