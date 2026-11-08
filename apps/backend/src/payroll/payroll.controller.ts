import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessScopeService } from '../access/access-scope.service';
import { TwoFactorService } from '../auth/two-factor.service';

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'AUDITOR'] as const;
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'] as const;

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly accessScope: AccessScopeService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  private async assertPayrollScope(user: any, id: string) {
    const payroll = await this.payrollService.findOne(id);
    const scope = await this.accessScope.getScope(user);
    if (scope.global) return payroll;
    if (!payroll.branchId) throw new ForbiddenException('Unassigned head-office payroll is restricted to Super Admin');
    await this.accessScope.assertBranch(user, payroll.branchId);
    return payroll;
  }

  private async requirePaymentMfa(req: any) {
    const authorization = String(req?.headers?.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    return this.twoFactorService.assertVerified(String(req?.user?.id || ''), token);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(@Req() req: any, @Body() body: { periodId: string; branchId?: string }) {
    const scope = await this.accessScope.getScope(req.user);
    if (!scope.global) {
      if (!body.branchId) throw new ForbiddenException('Branch assignment is required for payroll creation');
      await this.accessScope.assertBranch(req.user, body.branchId);
    } else if (body.branchId) {
      await this.accessScope.assertBranch(req.user, body.branchId);
    }
    return this.payrollService.create(body);
  }

  @Get()
  @Roles(...READ_ROLES)
  async findAll(@Req() req: any) {
    const scope = await this.accessScope.getScope(req.user);
    return this.payrollService.findAll(scope.global ? null : await this.accessScope.getBranchIds(req.user));
  }

  @Get('summary')
  @Roles(...READ_ROLES)
  async summary(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string) {
    const scope = await this.accessScope.getScope(req.user);
    if (branchId && !scope.global) await this.accessScope.assertBranch(req.user, branchId);
    return this.payrollService.summary(periodId, branchId, scope.global ? null : await this.accessScope.getBranchIds(req.user));
  }

  @Get('head-office-balance')
  @Roles('SUPER_ADMIN')
  headOfficeBalance() {
    return this.payrollService.headOfficeBalance();
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  async findOne(@Param('id') id: string, @Req() req: any) {
    await this.assertPayrollScope(req.user, id);
    return this.payrollService.findOne(id);
  }

  @Post(':id/items')
  @Roles(...WRITE_ROLES)
  async addItem(@Param('id') id: string, @Body() body: { staffId: string; basicSalary?: number; allowances?: number; deductions?: number }, @Req() req: any) {
    const payroll = await this.assertPayrollScope(req.user, id);
    const scope = await this.accessScope.getScope(req.user);
    if (!scope.global) {
      if (!payroll.branchId) throw new ForbiddenException('Unassigned head-office payroll is restricted to Super Admin');
      await this.accessScope.assertStaff(req.user, body.staffId);
    }
    return this.payrollService.addItem(id, body);
  }

  @Patch(':id/approve')
  @Roles(...WRITE_ROLES)
  async approve(@Param('id') id: string, @Req() req: any) {
    await this.assertPayrollScope(req.user, id);
    await this.requirePaymentMfa(req);
    return this.payrollService.approve(id);
  }

  @Patch(':id/pay')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async markPaid(@Param('id') id: string, @Req() req: any) {
    await this.assertPayrollScope(req.user, id);
    await this.requirePaymentMfa(req);
    return this.payrollService.markPaid(id);
  }
}
