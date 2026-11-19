import { UnauthorizedException } from '@nestjs/common';
import { assertLoginModeRole } from './auth-login-mode';

describe('PWFB login mode role validation', () => {
  it('allows a customer to use customer login', () => {
    expect(() => assertLoginModeRole('CUSTOMER', 'CUSTOMER')).not.toThrow();
  });
  it('allows a Super Admin to use Super Admin login', () => {
    expect(() => assertLoginModeRole('SUPER_ADMIN', 'SUPER_ADMIN')).not.toThrow();
  });
  it('does not let a customer pass Super Admin role validation', () => {
    expect(() => assertLoginModeRole('SUPER_ADMIN', 'CUSTOMER')).toThrow(UnauthorizedException);
  });
  it('does not let an administrator use customer login', () => {
    expect(() => assertLoginModeRole('CUSTOMER', 'ADMIN')).toThrow(UnauthorizedException);
  });
  it('keeps staff separate from privileged admin accounts', () => {
    expect(() => assertLoginModeRole('STAFF', 'SUPER_ADMIN')).toThrow(UnauthorizedException);
  });
  it('does not allow customer accounts through the staff login screen', () => {
    expect(() => assertLoginModeRole('STAFF', 'CUSTOMER')).toThrow(UnauthorizedException);
  });
});
