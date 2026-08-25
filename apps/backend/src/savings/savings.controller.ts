import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { SavingsService } from './savings.service';
import { CreateSavingsDto } from './dto/create-savings.dto';
import { UpdateSavingsDto } from './dto/update-savings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('savings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}
  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'TELLER')
  create(@Body() dto: CreateSavingsDto, @Req() req: any) { return this.savingsService.create(dto, req.user); }
  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'TELLER', 'AUDITOR')
  findAll(@Req() req: any) { return this.savingsService.findAll(req.user); }
  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'TELLER', 'AUDITOR')
  findOne(@Param('id') id: string, @Req() req: any) { return this.savingsService.findOne(id, req.user); }
  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateSavingsDto, @Req() req: any) { return this.savingsService.update(id, dto, req.user); }
  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string, @Req() req: any) { return this.savingsService.remove(id, req.user); }
}
