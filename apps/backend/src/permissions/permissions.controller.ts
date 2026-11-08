import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { PermissionsService, PERMISSION_KEYS } from './permissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get('me')
  async me(@Req() req: any) {
    const role = String(req.user?.role || 'STAFF');
    const entries = await Promise.all(PERMISSION_KEYS.map(async (permission) => [permission, await this.permissions.get(role, permission)] as const));
    return { role, permissions: Object.fromEntries(entries) };
  }

  @Get('wallet')
  @Roles('SUPER_ADMIN','ADMIN')
  list() { return this.permissions.list(); }

  @Patch('wallet')
  @Roles('SUPER_ADMIN','ADMIN')
  async update(@Body() body: { role: string; permission: string; enabled: boolean }) {
    if (!PERMISSION_KEYS.includes(body.permission as any)) throw new Error('Invalid permission');
    return this.permissions.set(body.role, body.permission as any, Boolean(body.enabled));
  }
}
