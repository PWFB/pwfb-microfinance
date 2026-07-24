import { PartialType } from '@nestjs/mapped-types';
import { CreateRepaymentDto } from './create-repayment.dto';

export class UpdateRepaymentDto extends PartialType(CreateRepaymentDto) {}
