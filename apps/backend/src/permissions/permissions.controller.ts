import { BadRequestException, Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
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
  @Roles('SUPER_ADMIN')
  list() { return this.permissions.list(); }

  @Patch('wallet')
  @Roles('SUPER_ADMIN')
  async update(@Body() body: { role: string; permission: string; enabled: boolean }) {
    const role = String(body?.role || '').trim().toUpperCase();
    const permission = String(body?.permission || '').trim().toUpperCase();
    if (!role) throw new BadRequestException('A role is required');
    if (!PERMISSION_KEYS.includes(permission as any)) throw new BadRequestException('Invalid permission');
    if (typeof body?.enabled !== 'boolean') throw new BadRequestException('enabled must be a boolean');
    return this.permissions.set(role, permission as any, body.enabled);
  }
}
