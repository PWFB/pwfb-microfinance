import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { SavingsService } from './savings.service';
import { CreateSavingsDto } from './dto/create-savings.dto';
import { UpdateSavingsDto } from './dto/update-savings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsService } from '../permissions/permissions.service';
import { TwoFactorService } from '../auth/two-factor.service';
import { AccessScopeService } from '../access/access-scope.service';

const VIEW_ROLES = ['SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'];
const OPERATION_ROLES = ['SUPER_ADMIN','ADMIN','BRANCH_MANAGER','TELLER','STAFF'];

@Controller('savings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SavingsController {
  constructor(
    private readonly savingsService: SavingsService,
    private readonly permissions: PermissionsService,
    private readonly twoFactorService: TwoFactorService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private async requireFinancialMfa(req: any) {
    const authorization = String(req?.headers?.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    return this.twoFactorService.assertVerified(String(req?.user?.id || ''), token);
  }

  @Post()
  @Roles(...OPERATION_ROLES)
  async create(@Req() req: any, @Body() dto: CreateSavingsDto) {
    await this.permissions.assert(req.user.role, 'SAVINGS_CREATE');
    await this.accessScope.assertCustomer(req.user, dto.customerId);
    await this.requireFinancialMfa(req);
    return this.savingsService.create(dto);
  }

  @Post(':id/deposit')
  @Roles(...OPERATION_ROLES)
  async deposit(@Req() req: any, @Param('id') id: string, @Body() body: { amount: number; description?: string }) {
    await this.permissions.assert(req.user.role, 'SAVINGS_CREATE');
    await this.accessScope.assertSavings(req.user, id);
    await this.requireFinancialMfa(req);
    return this.savingsService.deposit(id, body?.amount, body?.description);
  }

  @Post(':id/withdraw')
  @Roles(...OPERATION_ROLES)
  async withdraw(@Req() req: any, @Param('id') id: string, @Body() body: { amount: number; description?: string }) {
    await this.permissions.assert(req.user.role, 'SAVINGS_WITHDRAW');
    await this.accessScope.assertSavings(req.user, id);
    await this.requireFinancialMfa(req);
    return this.savingsService.withdraw(id, body?.amount, body?.description);
  }

  @Get()
  @Roles(...VIEW_ROLES)
  async findAll(@Req() req: any) {
    const rows = await this.savingsService.findAll();
    return this.accessScope.filterList(req.user, 'savings', rows);
  }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  async findOne(@Param('id') id: string, @Req() req: any) {
    await this.accessScope.assertSavings(req.user, id);
    return this.savingsService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN','ADMIN')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSavingsDto) {
    await this.accessScope.assertSavings(req.user, id);
    await this.permissions.assert(req.user.role, 'SAVINGS_CREATE');
    await this.requireFinancialMfa(req);
    return this.savingsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN','ADMIN')
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.accessScope.assertSavings(req.user, id);
    await this.requireFinancialMfa(req);
    return this.savingsService.remove(id);
  }
}
