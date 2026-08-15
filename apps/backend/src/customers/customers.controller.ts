import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
  ) {}

  @Post()
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'LOAN_OFFICER',
    'STAFF',
  )
  create(
    @Body() createCustomerDto: CreateCustomerDto,
    @Req() req: any,
  ) {
    return this.customersService.create(
      createCustomerDto,
      req.user,
    );
  }

  @Get()
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'CUSTOMER_SERVICE',
    'LOAN_OFFICER',
    'TELLER',
    'AUDITOR',
    'STAFF',
  )
  findAll(@Req() req: any) {
    return this.customersService.findAll(
      req.user,
    );
  }

  @Get(':id')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'CUSTOMER_SERVICE',
    'LOAN_OFFICER',
    'TELLER',
    'AUDITOR',
    'STAFF',
  )
  findOne(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.customersService.findOne(
      id,
      req.user,
    );
  }

  @Patch(':id')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'CUSTOMER_SERVICE',
  )
  update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(
      id,
      updateCustomerDto,
    );
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(
    @Param('id') id: string,
  ) {
    return this.customersService.remove(id);
  }
}
