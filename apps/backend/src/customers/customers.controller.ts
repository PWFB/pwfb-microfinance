import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'LOAN_OFFICER', 'STAFF')
  create(@Body() dto: CreateCustomerDto, @Req() req: any) { return this.customersService.create(dto, req.user); }

  @Get('me')
  @Roles('CUSTOMER')
  me(@Req() req: any) { return this.customersService.findMe(req.user); }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'CUSTOMER_SERVICE', 'LOAN_OFFICER', 'TELLER', 'AUDITOR', 'STAFF')
  findAll(@Req() req: any) { return this.customersService.findAll(req.user); }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'CUSTOMER_SERVICE', 'LOAN_OFFICER', 'TELLER', 'AUDITOR', 'STAFF')
  findOne(@Param('id') id: string, @Req() req: any) { return this.customersService.findOne(id, req.user); }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'CUSTOMER_SERVICE')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @Req() req: any) { return this.customersService.update(id, dto, req.user); }

  @Post(':id/reset-password')
  @Roles('SUPER_ADMIN')
  resetPassword(@Param('id') id: string) { return this.customersService.resetPassword(id); }

  @Post(':id/identity-override')
  @Roles('SUPER_ADMIN')
  overrideIdentity(@Param('id') id: string, @Body() body: { type: 'BVN' | 'NIN'; value: string; reason: string }, @Req() req: any) { return this.customersService.overrideIdentity(id, body?.type, body?.value, body?.reason, req.user); }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string) { return this.customersService.remove(id); }
}
