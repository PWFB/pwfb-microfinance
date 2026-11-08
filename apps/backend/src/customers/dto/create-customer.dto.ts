import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  MaxLength,
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
  @IsIn(['INDIVIDUAL', 'GROUP'])
  registrationType?: 'INDIVIDUAL' | 'GROUP';

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  groupName?: string;

  @IsBoolean()
  virtualAccountConsent: boolean;
}
