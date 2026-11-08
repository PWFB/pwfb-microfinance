import { IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateGuarantorDto {
  @IsString()
  loanId: string;

  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  lastName: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsString()
  idType: string;

  @IsString()
  idNumber: string;

  @IsOptional()
  @IsString()
  idDocument?: string;

  @IsOptional()
  @IsString()
  passportPhoto?: string;

  @IsOptional()
  @IsString()
  verificationNote?: string;
}
