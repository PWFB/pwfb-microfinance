import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { PermissionsService, PERMISSION_KEYS } from './permissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN','ADMIN')
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get('wallet') list() { return this.permissions.list(); }

  @Patch('wallet') async update(@Body() body: { role: string; permission: string; enabled: boolean }) {
    if (!PERMISSION_KEYS.includes(body.permission as any)) throw new Error('Invalid wallet permission');
    return this.permissions.set(body.role, body.permission as any, Boolean(body.enabled));
  }
}
