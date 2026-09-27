import { IsIn, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  identifier?: string;

  // Backward compatibility for existing web/app clients.
  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsIn(['SUPER_ADMIN', 'STAFF', 'CUSTOMER'])
  loginMode?: 'SUPER_ADMIN' | 'STAFF' | 'CUSTOMER';
}
