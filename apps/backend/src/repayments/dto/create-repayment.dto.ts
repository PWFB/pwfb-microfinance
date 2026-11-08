import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';

export class CreateRepaymentDto {
  @IsString()
  loanId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  reference: string;

  @IsBoolean()
  cashReceivedConfirmed: boolean;
}
