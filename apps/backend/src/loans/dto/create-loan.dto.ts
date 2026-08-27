import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateLoanDto {
  @IsString() customerId: string;
  @IsNumber() amount: number;
  @IsOptional() @IsNumber() interestRate?: number;
  @IsOptional() @IsString() loanType?: string;
  @IsOptional() @IsNumber() duration?: number;
  @IsOptional() @IsString() repaymentFrequency?: string;
  @IsOptional() @IsString() purpose?: string;
  @IsOptional() @IsNumber() interestAmount?: number;
  @IsOptional() @IsNumber() totalRepayment?: number;
  @IsOptional() @IsNumber() installmentAmount?: number;
  @IsOptional() @IsString() passportPhoto?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsNumber() disbursementAmount?: number;
  @IsOptional() @IsString() disbursementAccountNumber?: string;
  @IsOptional() @IsString() disbursementAccountName?: string;
  @IsOptional() @IsString() disbursementBankCode?: string;
  @IsOptional() @IsString() disbursementBankName?: string;
  @IsOptional() @IsBoolean() disbursementUsesAlternativeAccount?: boolean;
}
