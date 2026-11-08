import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessScopeService } from '../access/access-scope.service';

@Controller('branches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchController {
  constructor(private readonly branchService: BranchService, private readonly accessScope: AccessScopeService) {}

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@Body() dto: CreateBranchDto) { return this.branchService.create(dto); }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'TELLER', 'CREDIT_OFFICER')
  async findAll(@Req() req: any) {
    const rows = await this.branchService.findAll();
    return this.accessScope.filterList(req.user, 'branches', rows);
  }

  @Get('provision-virtual-accounts')
  @Roles('SUPER_ADMIN')
  provisionVirtualAccounts() { return this.branchService.provisionVirtualAccounts(); }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'TELLER', 'CREDIT_OFFICER')
  async findOne(@Param('id') id: string, @Req() req: any) {
    await this.accessScope.assertBranch(req.user, id);
    return this.branchService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) { return this.branchService.update(id, dto); }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('id') id: string) { return this.branchService.remove(id); }
}
