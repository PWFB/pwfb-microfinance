import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { UpdateRepaymentDto } from './dto/update-repayment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessScopeService } from '../access/access-scope.service';

const VIEW_ROLES = ['SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER'];

@Controller('repayments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RepaymentsController {
  constructor(private readonly repaymentsService: RepaymentsService, private readonly accessScope: AccessScopeService) {}

  @Post()
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','LOAN_OFFICER','TELLER','CREDIT_OFFICER')
  async create(@Body() dto: CreateRepaymentDto, @Req() req: any) { await this.accessScope.assertLoan(req.user, dto.loanId); return this.repaymentsService.create(dto); }

  @Get()
  @Roles(...VIEW_ROLES)
  async findAll(@Req() req: any) {
    const rows = await this.repaymentsService.findAll();
    const loans = rows.map((row: any) => row.loan).filter(Boolean);
    const visibleLoans = await this.accessScope.filterList(req.user, 'loans', loans);
    const visibleIds = new Set(visibleLoans.map((loan: any) => loan.id));
    return rows.filter((row: any) => visibleIds.has(row.loanId));
  }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  async findOne(@Param('id') id: string, @Req() req: any) { const row = await this.repaymentsService.findOne(id); await this.accessScope.assertLoan(req.user, row.loanId); return row; }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateRepaymentDto, @Req() req: any) { const row = await this.repaymentsService.findOne(id); await this.accessScope.assertLoan(req.user, row.loanId); return this.repaymentsService.update(id, dto); }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  async remove(@Param('id') id: string, @Req() req: any) { const row = await this.repaymentsService.findOne(id); await this.accessScope.assertLoan(req.user, row.loanId); return this.repaymentsService.remove(id); }
}
