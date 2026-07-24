import {
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateLoanDto {
  @IsString()
  customerId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsNumber()
  interestRate?: number;

  @IsOptional()
  @IsString()
  status?: string;
}
