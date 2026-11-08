import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessScopeService } from '../access/access-scope.service';
import { TwoFactorService } from '../auth/two-factor.service';

const VIEW_ROLES = ['SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER'];

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly accessScope: AccessScopeService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Post()
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER')
  async create(@Body() dto: CreateTransactionDto, @Req() req: any) {
    await this.accessScope.assertCustomer(req.user, dto.customerId);
    const authorization = String(req?.headers?.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    await this.twoFactorService.assertVerified(String(req?.user?.id || ''), token);
    return this.transactionsService.create(dto);
  }

  @Get()
  @Roles(...VIEW_ROLES)
  findAll(@Req() req: any) { return this.transactionsService.findAll(req.user); }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  findOne(@Param('id') id: string, @Req() req: any) { return this.transactionsService.findOne(id, req.user); }

  @Patch(':id')
  @Roles('SUPER_ADMIN','ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateTransactionDto, @Req() req: any) {
    await this.transactionsService.findOne(id, req.user);
    return this.transactionsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN','ADMIN')
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.transactionsService.findOne(id, req.user);
    return this.transactionsService.remove(id);
  }
}
