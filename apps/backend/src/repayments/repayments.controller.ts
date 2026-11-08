import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { UpdateRepaymentDto } from './dto/update-repayment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessScopeService } from '../access/access-scope.service';
import { TwoFactorService } from '../auth/two-factor.service';

const VIEW_ROLES = ['SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER'];

@Controller('repayments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RepaymentsController {
  constructor(
    private readonly repaymentsService: RepaymentsService,
    private readonly accessScope: AccessScopeService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  private async requireFinancialMfa(req: any) {
    const authorization = String(req?.headers?.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    return this.twoFactorService.assertVerified(String(req?.user?.id || ''), token);
  }

  @Post()
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','LOAN_OFFICER','TELLER','CREDIT_OFFICER')
  async create(@Body() dto: CreateRepaymentDto, @Req() req: any) {
    await this.accessScope.assertLoan(req.user, dto.loanId);
    await this.requireFinancialMfa(req);
    return this.repaymentsService.create(dto, req.user);
  }

  @Get()
  @Roles(...VIEW_ROLES)
  findAll(@Req() req: any) { return this.repaymentsService.findAll(req.user); }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  findOne(@Param('id') id: string, @Req() req: any) { return this.repaymentsService.findOne(id, req.user); }

  @Patch(':id')
  @Roles('SUPER_ADMIN','ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateRepaymentDto, @Req() req: any) {
    await this.requireFinancialMfa(req);
    return this.repaymentsService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN','ADMIN')
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.requireFinancialMfa(req);
    return this.repaymentsService.remove(id, req.user);
  }
}
