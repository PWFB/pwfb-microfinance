import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const VIEW_ROLES = ['SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'];

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','TELLER')
  create(@Body() dto: CreateTransactionDto, @Req() req: any) { return this.transactionsService.create(dto, req.user); }

  @Get()
  @Roles(...VIEW_ROLES)
  findAll(@Req() req: any) { return this.transactionsService.findAll(req.user); }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  findOne(@Param('id') id: string, @Req() req: any) { return this.transactionsService.findOne(id, req.user); }

  @Patch(':id')
  @Roles('SUPER_ADMIN','ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto, @Req() req: any) { return this.transactionsService.update(id, dto, req.user); }

  @Delete(':id')
  @Roles('SUPER_ADMIN','ADMIN')
  remove(@Param('id') id: string, @Req() req: any) { return this.transactionsService.remove(id, req.user); }
}
