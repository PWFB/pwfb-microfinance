import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { SavingsService } from './savings.service';
import { CreateSavingsDto } from './dto/create-savings.dto';
import { UpdateSavingsDto } from './dto/update-savings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsService } from '../permissions/permissions.service';

const VIEW_ROLES = ['SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'];
const OPERATION_ROLES = ['SUPER_ADMIN','ADMIN','BRANCH_MANAGER','TELLER','STAFF'];

@Controller('savings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SavingsController {
  constructor(private readonly savingsService: SavingsService, private readonly permissions: PermissionsService) {}

  @Post()
  @Roles(...OPERATION_ROLES)
  async create(@Req() req: any, @Body() dto: CreateSavingsDto) {
    await this.permissions.assert(req.user.role, 'SAVINGS_CREATE');
    return this.savingsService.create(dto);
  }

  @Post(':id/deposit')
  @Roles(...OPERATION_ROLES)
  async deposit(@Req() req: any, @Param('id') id: string, @Body() body: { amount: number; description?: string }) {
    await this.permissions.assert(req.user.role, 'SAVINGS_CREATE');
    return this.savingsService.deposit(id, body?.amount, body?.description);
  }

  @Post(':id/withdraw')
  @Roles(...OPERATION_ROLES)
  async withdraw(@Req() req: any, @Param('id') id: string, @Body() body: { amount: number; description?: string }) {
    await this.permissions.assert(req.user.role, 'SAVINGS_WITHDRAW');
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
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSavingsDto) {
    await this.permissions.assert(req.user.role, 'SAVINGS_CREATE');
    return this.savingsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN','ADMIN')
  remove(@Param('id') id: string) { return this.savingsService.remove(id); }
}
