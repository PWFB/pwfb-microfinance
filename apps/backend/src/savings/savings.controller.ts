import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SavingsService } from './savings.service';
import { CreateSavingsDto } from './dto/create-savings.dto';
import { UpdateSavingsDto } from './dto/update-savings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const VIEW_ROLES = ['SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER'];
const OPERATION_ROLES = ['SUPER_ADMIN','ADMIN','BRANCH_MANAGER','TELLER'];

@Controller('savings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Post()
  @Roles(...OPERATION_ROLES)
  create(@Body() dto: CreateSavingsDto) { return this.savingsService.create(dto); }

  @Post(':id/deposit')
  @Roles(...OPERATION_ROLES)
  deposit(@Param('id') id: string, @Body() body: { amount: number; description?: string }) {
    return this.savingsService.deposit(id, body?.amount, body?.description);
  }

  @Post(':id/withdraw')
  @Roles(...OPERATION_ROLES)
  withdraw(@Param('id') id: string, @Body() body: { amount: number; description?: string }) {
    return this.savingsService.withdraw(id, body?.amount, body?.description);
  }

  @Get()
  @Roles(...VIEW_ROLES)
  findAll() { return this.savingsService.findAll(); }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  findOne(@Param('id') id: string) { return this.savingsService.findOne(id); }

  @Patch(':id')
  @Roles('SUPER_ADMIN','ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateSavingsDto) { return this.savingsService.update(id, dto); }

  @Delete(':id')
  @Roles('SUPER_ADMIN','ADMIN')
  remove(@Param('id') id: string) { return this.savingsService.remove(id); }
}
