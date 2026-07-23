import { PartialType } from '@nestjs/mapped-types';
import { CreateSavingsDto } from './create-savings.dto';

export class UpdateSavingsDto extends PartialType(
  CreateSavingsDto,
) {}
