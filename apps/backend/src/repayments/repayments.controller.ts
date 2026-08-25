import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { UpdateRepaymentDto } from './dto/update-repayment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const VIEW_ROLES = ['SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER'];

@Controller('repayments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RepaymentsController {
  constructor(private readonly repaymentsService: RepaymentsService) {}

  @Post()
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','LOAN_OFFICER','TELLER')
  create(@Body() dto: CreateRepaymentDto) { return this.repaymentsService.create(dto); }

  @Get()
  @Roles(...VIEW_ROLES)
  findAll() { return this.repaymentsService.findAll(); }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  findOne(@Param('id') id: string) { return this.repaymentsService.findOne(id); }

  @Patch(':id')
  @Roles('SUPER_ADMIN','ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateRepaymentDto) { return this.repaymentsService.update(id, dto); }

  @Delete(':id')
  @Roles('SUPER_ADMIN','ADMIN')
  remove(@Param('id') id: string) { return this.repaymentsService.remove(id); }
}
