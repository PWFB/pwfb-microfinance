import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('organization')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('hierarchy')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'MONITORING_TEAM', 'AUDITOR', 'AREA_MANAGER', 'BRANCH_MANAGER', 'CREDIT_OFFICER')
  hierarchy(@Req() req: any) {
    return this.organizationService.listForUser(req.user.id);
  }

  @Get('registration-hierarchy')
  @Roles('SUPER_ADMIN', 'ADMIN')
  registrationHierarchy(@Req() req: any) {
    return this.organizationService.registrationHierarchy(req.user.id);
  }

  @Post('regions')
  @Roles('SUPER_ADMIN')
  createRegion(@Body() body: { name: string; code?: string }, @Req() req: any) {
    return this.organizationService.createRegion(body, req.user.id);
  }

  @Post('divisions')
  @Roles('SUPER_ADMIN', 'REGIONAL_MANAGER')
  createDivision(@Body() body: { name: string; regionId: string }, @Req() req: any) {
    return this.organizationService.createDivision(body, req.user.id);
  }

  @Post('areas')
  @Roles('SUPER_ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER')
  createArea(@Body() body: { name: string; regionId: string; divisionId?: string }, @Req() req: any) {
    return this.organizationService.createArea(body, req.user.id);
  }

  @Get('regions/:id/staff')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'MONITORING_TEAM', 'AUDITOR', 'AREA_MANAGER', 'BRANCH_MANAGER', 'CREDIT_OFFICER')
  regionStaff(@Param('id') id: string, @Req() req: any) {
    return this.organizationService.regionStaff(id, req.user.id);
  }
}
