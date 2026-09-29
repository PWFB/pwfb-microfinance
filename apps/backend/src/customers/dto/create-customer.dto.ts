import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsNumber,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsNumber()
  registrationFee?: number;

  @IsOptional()
  @IsNumber()
  clientCardFee?: number;

  @IsOptional()
  @IsNumber()
  otherFee?: number;
}
