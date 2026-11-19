import { UnauthorizedException } from '@nestjs/common';

export type LoginMode = 'SUPER_ADMIN' | 'ADMIN' | 'STAFF' | 'CUSTOMER';

export function assertLoginModeRole(modeValue: string, roleValue: string) {
  const mode = String(modeValue || '').trim().toUpperCase();
  const role = String(roleValue || '').trim().toUpperCase();
  if (!['SUPER_ADMIN', 'ADMIN', 'STAFF', 'CUSTOMER'].includes(mode)) {
    throw new UnauthorizedException('Choose a valid PWFB login type and try again.');
  }
  if (mode === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
    throw new UnauthorizedException('This account is not a Super Admin account. Use another login.');
  }
  if (mode === 'ADMIN' && role !== 'ADMIN') {
    throw new UnauthorizedException('This account is not an Admin account. Use another login.');
  }
  if (mode === 'STAFF' && (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'CUSTOMER')) {
    throw new UnauthorizedException(role === 'CUSTOMER' ? 'This account is not a Staff account. Use another login.' : 'Admin accounts must use Admin or Super Admin Login.');
  }
  if (mode === 'CUSTOMER' && role !== 'CUSTOMER') {
    throw new UnauthorizedException('This account is not a Customer account. Use another login.');
  }
}
