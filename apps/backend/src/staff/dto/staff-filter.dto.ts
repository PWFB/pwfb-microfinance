import { IsOptional, IsString } from 'class-validator';

export class StaffFilterDto {
  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  employmentStatus?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
