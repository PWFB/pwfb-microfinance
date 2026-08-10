import {
  IsNumber,
  IsString,
  IsOptional,
} from 'class-validator';

export class CreateSavingsDto {
  @IsString()
  customerId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  accountType?: string;
}
