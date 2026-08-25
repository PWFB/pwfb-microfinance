import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}
  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'TELLER')
  create(@Body() dto: CreateTransactionDto, @Req() req: any) { return this.transactionsService.create(dto, req.user); }
  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'TELLER', 'AUDITOR')
  findAll(@Req() req: any) { return this.transactionsService.findAll(req.user); }
  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'TELLER', 'AUDITOR')
  findOne(@Param('id') id: string, @Req() req: any) { return this.transactionsService.findOne(id, req.user); }
  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'TELLER')
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto, @Req() req: any) { return this.transactionsService.update(id, dto, req.user); }
  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string, @Req() req: any) { return this.transactionsService.remove(id, req.user); }
}
