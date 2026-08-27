import { AuthService } from './auth.service';

declare module './auth.service' {
  interface AuthService {
    linkExistingCustomer(userId: string): Promise<any>;
  }
}

AuthService.prototype.linkExistingCustomer = async function(this: any, userId: string) {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  // Prefer the existing customer record with the same verified email.
  // This avoids creating a second customer when Google Auth is used.
  const customer = await this.prisma.customer.findUnique({ where: { email: user.email } });
  if (!customer) return null;

  if (customer.userId && customer.userId !== user.id) {
    throw new Error('This PWFB customer is already linked to another user account');
  }

  if (user.customerId && user.customerId !== customer.id) {
    throw new Error('This user account is already linked to another PWFB customer');
  }

  if (!customer.userId || !user.customerId || user.phone !== customer.phone) {
    await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id: customer.id },
        data: { userId: user.id },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { customerId: customer.id, phone: customer.phone || user.phone },
      }),
    ]);
  }

  return { linked: true, customerId: customer.id, phone: customer.phone || user.phone || null };
};

const originalGoogleLogin = AuthService.prototype.googleLogin;
AuthService.prototype.googleLogin = async function(this: any, ...args: any[]) {
  const result = await originalGoogleLogin.apply(this, args);
  try {
    await this.linkExistingCustomer(result?.user?.id);
    if (result?.user) {
      const refreshed = await this.prisma.user.findUnique({ where: { id: result.user.id } });
      if (refreshed) {
        const { password, ...safeUser } = refreshed;
        result.user = safeUser;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('already linked')) throw error;
    // Customer linking is intentionally best-effort when no matching customer exists.
  }
  return result;
};
