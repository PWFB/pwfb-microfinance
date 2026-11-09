import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessScopeService } from '../access/access-scope.service';
import { CustomerVirtualAccountService } from '../banking/customer-virtual-account.service';
import { ChargesService } from '../charges/charges.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService, private readonly customerVirtualAccounts: CustomerVirtualAccountService, private readonly accessScope: AccessScopeService, private readonly charges: ChargesService) {}

  private normalizeName(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, ''); }
  private async generateLoginEmail(firstName: string, lastName: string) { const base = `${this.normalizeName(firstName)}.${this.normalizeName(lastName)}`; let email = `${base}@pwfb.com`; let counter = 1; while (await this.prisma.user.findUnique({ where: { email } })) { email = `${base}${counter}@pwfb.com`; counter++; } return email; }
  private generateTemporaryPassword() { return `PWFB-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`; }
  private async generateCustomerId() { const count = await this.prisma.customer.count(); let number = count + 1; let customerId = `PWFB-CUS-${String(number).padStart(4, '0')}`; while (await this.prisma.customer.findUnique({ where: { id: customerId } })) { number++; customerId = `PWFB-CUS-${String(number).padStart(4, '0')}`; } return customerId; }

  async create(dto: CreateCustomerDto, authUser: any) {
    if (dto.virtualAccountConsent !== true) throw new BadRequestException('Customer consent is required before creating a Paystack virtual account');
    const userId = String(authUser?.id || '').trim();
    const claimedStaffId = String(authUser?.staffId || '').trim();
    let staff = userId
      ? await this.prisma.staff.findUnique({ where: { userId }, include: { branch: true } })
      : null;
    if (!staff && claimedStaffId) {
      staff = await this.prisma.staff.findUnique({ where: { id: claimedStaffId }, include: { branch: true } });
    }
    if (staff && claimedStaffId && staff.id !== claimedStaffId) {
      throw new UnauthorizedException('Staff identity links do not match. Contact Super Admin before registering customers.');
    }
    if (!staff || staff.employmentStatus !== 'ACTIVE') {
      throw new UnauthorizedException('An active staff account linked to this login is required to register customers');
    }
    const customerId = await this.generateCustomerId(); const email = String(dto.email || '').trim().toLowerCase() || await this.generateLoginEmail(dto.firstName, dto.lastName); const temporaryPassword = this.generateTemporaryPassword(); const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        let group: any = null;
        if (dto.groupId) { group = await tx.clientGroup.findUnique({ where: { id: dto.groupId } }); if (!group) throw new BadRequestException('Client group not found'); if (group.branchId && group.branchId !== staff.branchId) throw new BadRequestException('Client group belongs to another branch'); }
        const customer = await tx.customer.create({ data: { id: customerId, firstName: dto.firstName, middleName: dto.middleName?.trim() || undefined, lastName: dto.lastName, email, phone: dto.phone, address: dto.address, dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined, branch: { connect: { id: staff.branchId } }, assignedStaff: { connect: { id: staff.id } }, ...(dto.groupId ? { clientGroup: { connect: { id: dto.groupId } } } : {}), wallet: { create: {} } } });
        const user = await tx.user.create({ data: { email, password: hashedPassword, firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone, role: 'CUSTOMER', customer: { connect: { id: customer.id } } } });
        const registrationFee = await this.charges.consumeRegistrationReceipt(
          tx,
          dto.registrationFeeReceiptId,
          customer.id,
          staff.branchId,
          staff.id,
        );
        return { customer, user, registrationFee };
      });

      let virtualAccounts: any[] = [];
      let virtualAccountWarning: string | null = null;
      try {
        virtualAccounts = await this.customerVirtualAccounts.ensure(result.customer.id, undefined, true);
      } catch (error) {
        virtualAccountWarning = error instanceof Error ? error.message : 'Customer virtual account provisioning is pending';
        try { virtualAccounts = await this.customerVirtualAccounts.list(result.customer.id); } catch { virtualAccounts = []; }
      }

      return { message: 'Client created successfully', client: { id: result.customer.id, customerId: result.customer.id, firstName: result.customer.firstName, middleName: result.customer.middleName, lastName: result.customer.lastName, email: result.customer.email, branchId: result.customer.branchId, assignedStaffId: result.customer.assignedStaffId, groupId: result.customer.groupId }, registrationFee: result.registrationFee, wallet: { customerId: result.customer.id, currency: 'NGN', status: 'ACTIVE' }, virtualAccounts, virtualAccountWarning, login: { email, temporaryPassword } };
    } catch (error) { if (error instanceof BadRequestException) throw error; throw new BadRequestException(error instanceof Error ? error.message : 'Unable to create client'); }
  }

  async findMe(authUser: any) {
    if (!authUser?.id) throw new UnauthorizedException('Authentication required');
    const user = await this.prisma.user.findUnique({ where: { id: authUser.id }, include: { customer: { include: { savings: true, loans: true, transactions: true, branch: true, assignedStaff: { select: { staffId: true, firstName: true, lastName: true } }, clientGroup: true, bankAccounts: { include: { institution: true } }, virtualAccounts: { include: { institution: true, branch: true } }, wallet: true } } } });
    if (!user?.customer) throw new NotFoundException('Customer profile not found'); return { ...user.customer, identityVerification: await this.getIdentityVerification(user.customer.id, authUser) };
  }

  async findAll(authUser?: any, search?: string) {
    const role = String(authUser?.role || '').toUpperCase();
    const scope = authUser ? await this.accessScope.getScope(authUser) : null;
    const q = String(search || '').trim();
    const where: any = role === 'CREDIT_OFFICER' ? { assignedStaffId: scope?.staffId || '__NO_ASSIGNED_STAFF__' } : {};
    if (q) where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } },
      { id: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }, { email: { contains: q, mode: 'insensitive' } },
    ];
    const rows = await this.prisma.customer.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 200,
      include: { savings: true, loans: true, transactions: true, branch: true, assignedStaff: true, clientGroup: true, bankAccounts: { include: { institution: true } }, virtualAccounts: { include: { institution: true, branch: true } }, wallet: true },
    });
    return authUser ? this.accessScope.filterList(authUser, 'customers', rows) : rows;
  }

  async history(id: string, authUser: any) {
    const customer = await this.findOne(id, authUser);
    const [ledgerTransactions, walletTransactions] = await Promise.all([
      this.prisma.transaction.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.walletTransaction.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    const legacy = ledgerTransactions.map((transaction) => ({
      ...transaction, customer: { id, firstName: customer.firstName, lastName: customer.lastName },
      source: 'LEDGER', status: 'COMPLETED', provider: null, providerReference: null,
      reference: null, processedAt: transaction.createdAt, walletBalanceBefore: null, walletBalanceAfter: null,
    }));
    const wallet = walletTransactions.map((transaction) => ({
      id: transaction.id, customerId: transaction.customerId,
      customer: { id, firstName: customer.firstName, lastName: customer.lastName },
      type: transaction.type, amount: transaction.amount, description: transaction.description,
      createdAt: transaction.createdAt, updatedAt: transaction.createdAt, source: 'WALLET',
      status: transaction.status, provider: transaction.provider, providerReference: transaction.providerReference,
      reference: transaction.reference, processedAt: transaction.processedAt,
      walletBalanceBefore: transaction.previousBalance, walletBalanceAfter: transaction.newBalance,
      branchId: transaction.branchId, staffId: transaction.staffId, failureReason: transaction.failureReason,
    }));
    return [...legacy, ...wallet].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private maskIdentity(value?: string | null) {
    if (!value) return null;
    const stored = String(value);
    // New records are stored masked. Older rows may contain legacy raw digits;
    // never return those raw values to an API response.
    if (stored.includes('•') || stored.includes('*')) return stored;
    const digits = stored.replace(/\D/g, '');
    return digits ? `${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}` : null;
  }

  private async getIdentityVerification(customerId: string, authUser?: any) {
    await this.customerVirtualAccounts.ensureIdentitySchema();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, bvn, bvn_status AS "bvnStatus", bvn_verified_at AS "bvnVerifiedAt",
       bvn_overridden_at AS "bvnOverriddenAt", bvn_override_by_email AS "bvnOverrideByEmail",
       bvn_override_reason AS "bvnOverrideReason", bvn_provider AS "bvnProvider",
       bvn_reference AS "bvnReference", bvn_name_match AS "bvnNameMatch",
       bvn_dob_match AS "bvnDateOfBirthMatch", bvn_consent_at AS "bvnConsentAt",
       nin, nin_status AS "ninStatus", nin_verified_at AS "ninVerifiedAt",
       nin_overridden_at AS "ninOverriddenAt", nin_override_by_email AS "ninOverrideByEmail",
       nin_override_reason AS "ninOverrideReason", nin_provider AS "ninProvider",
       nin_reference AS "ninReference", nin_name_match AS "ninNameMatch",
       nin_dob_match AS "ninDateOfBirthMatch", nin_consent_at AS "ninConsentAt",
       created_at AS "createdAt", updated_at AS "updatedAt"
       FROM customer_identity_verifications WHERE customer_id = $1 LIMIT 1`,
      customerId,
    );
    const row = rows[0];
    if (!row) return null;
    const role = String(authUser?.role || '').toUpperCase();
    const mayViewOverrideAudit = role === 'SUPER_ADMIN' || role === 'ADMIN';
    return {
      id: row.id,
      bvn: this.maskIdentity(row.bvn),
      bvnStatus: row.bvnStatus,
      bvnVerifiedAt: row.bvnVerifiedAt,
      bvnProvider: row.bvnProvider,
      bvnReference: row.bvnReference,
      bvnNameMatch: row.bvnNameMatch,
      bvnDateOfBirthMatch: row.bvnDateOfBirthMatch,
      bvnConsentAt: row.bvnConsentAt,
      ...(mayViewOverrideAudit ? {
        bvnOverriddenAt: row.bvnOverriddenAt,
        bvnOverrideByEmail: row.bvnOverrideByEmail,
        bvnOverrideReason: row.bvnOverrideReason,
      } : {}),
      nin: this.maskIdentity(row.nin),
      ninStatus: row.ninStatus,
      ninVerifiedAt: row.ninVerifiedAt,
      ninProvider: row.ninProvider,
      ninReference: row.ninReference,
      ninNameMatch: row.ninNameMatch,
      ninDateOfBirthMatch: row.ninDateOfBirthMatch,
      ninConsentAt: row.ninConsentAt,
      ...(mayViewOverrideAudit ? {
        ninOverriddenAt: row.ninOverriddenAt,
        ninOverrideByEmail: row.ninOverrideByEmail,
        ninOverrideReason: row.ninOverrideReason,
      } : {}),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findOne(id: string, authUser?: any) { const customer = await this.prisma.customer.findUnique({ where: { id }, include: { savings: true, loans: true, transactions: true, branch: true, assignedStaff: true, clientGroup: true, bankAccounts: { include: { institution: true } }, virtualAccounts: { include: { institution: true, branch: true } }, wallet: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, createdAt: true, updatedAt: true } } } }); if (!customer) throw new NotFoundException('Customer not found'); if (authUser) await this.accessScope.assertCustomer(authUser, id); return { ...customer, identityVerification: await this.getIdentityVerification(customer.id, authUser) }; }

  async update(id: string, dto: UpdateCustomerDto, authUser: any) {
    const customer = await this.prisma.customer.findUnique({ where: { id }, include: { user: true } });
    if (!customer) throw new NotFoundException('Customer not found');

    const role = String(authUser?.role || '').toUpperCase();
    const assignmentChanges = [
      ['branchId', customer.branchId],
      ['assignedStaffId', customer.assignedStaffId],
      ['groupId', customer.groupId],
    ] as const;
    for (const [field, currentValue] of assignmentChanges) {
      const nextValue = dto[field];
      if (nextValue !== undefined && !String(nextValue || '').trim()) {
        throw new BadRequestException(`Customer ${field} must be a valid non-empty identifier`);
      }
      if (nextValue !== undefined && String(nextValue || '') !== String(currentValue || '')) {
        if (currentValue) {
          throw new BadRequestException(`Customer ${field} is an immutable registration assignment and cannot be changed`);
        }
        if (role !== 'SUPER_ADMIN') {
          throw new BadRequestException(`Only Super Admin may backfill a missing customer ${field}`);
        }
      }
    }

    if (dto.branchId) {
      await this.accessScope.assertBranch(authUser, dto.branchId);
      if (!(await this.prisma.branch.findUnique({ where: { id: dto.branchId } }))) throw new BadRequestException('Branch not found');
    }

    const shouldCheckStaff = dto.branchId !== undefined || dto.assignedStaffId !== undefined;
    const effectiveStaffId = dto.assignedStaffId ?? customer.assignedStaffId;
    const assignedStaff = shouldCheckStaff && effectiveStaffId
      ? await this.prisma.staff.findUnique({ where: { id: effectiveStaffId } })
      : null;
    if (shouldCheckStaff && effectiveStaffId && !assignedStaff) throw new BadRequestException('Assigned staff not found');
    if (dto.assignedStaffId) await this.accessScope.assertStaff(authUser, dto.assignedStaffId);

    const effectiveBranchId = dto.branchId ?? customer.branchId ?? assignedStaff?.branchId;
    if (assignedStaff && effectiveBranchId && assignedStaff.branchId !== effectiveBranchId) {
      throw new BadRequestException('Assigned staff member must belong to the customer branch');
    }

    if (dto.groupId) {
      const group = await this.prisma.clientGroup.findUnique({ where: { id: dto.groupId } });
      if (!group) throw new BadRequestException('Client group not found');
      if (group.branchId && effectiveBranchId && group.branchId !== effectiveBranchId) {
        throw new BadRequestException('Client group belongs to another branch');
      }
    }

    const firstName = dto.firstName ?? customer.firstName;
    const middleName = dto.middleName !== undefined ? (dto.middleName.trim() || null) : customer.middleName;
    const lastName = dto.lastName ?? customer.lastName;
    const email = dto.email ?? customer.email;
    const phone = dto.phone ?? customer.phone;
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: {
          firstName,
          middleName,
          lastName,
          email,
          phone,
          address: dto.address,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          branchId: dto.branchId,
          assignedStaffId: dto.assignedStaffId,
          groupId: dto.groupId,
        },
      });
      if (customer.userId) {
        await tx.user.update({
          where: { id: customer.userId },
          data: { ...(email ? { email } : {}), firstName, lastName, phone },
        });
      }
      return updatedCustomer;
    });
    return { message: 'Customer profile updated successfully', customer: updated };
  }

  async resetPassword(id: string) { const customer = await this.prisma.customer.findUnique({ where: { id }, include: { user: true } }); if (!customer?.user) throw new NotFoundException('Customer login account not found'); const temporaryPassword = `PWFB-${randomBytes(5).toString('hex').toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`; await this.prisma.user.update({ where: { id: customer.user.id }, data: { password: await bcrypt.hash(temporaryPassword, 10) } }); return { message: 'Customer password reset successfully', customerId: customer.id, loginEmail: customer.user.email, temporaryPassword, note: 'For security, PWFB never stores or displays the previous plaintext password.' }; }

  async verifyIdentity(customerId: string, input: { bvn: string; bankCode: string; accountNumber: string; consentConfirmed?: boolean }, authUser: any) {
    // Existing Paystack path: validates BVN against a linked bank account and
    // then waits for Paystack's customer-identification webhook before DVA setup.
    await this.findOne(customerId, authUser);
    return this.customerVirtualAccounts.startIdentityVerification(customerId, input);
  }

  async verifyCustomerIdentifier(customerId: string, type: string, value: string, consentConfirmed: boolean, authUser: any) {
    await this.findOne(customerId, authUser);
    return this.customerVirtualAccounts.verifyCustomerIdentity(customerId, type, value, consentConfirmed, authUser);
  }

  async verifyMyIdentifier(type: string, value: string, consentConfirmed: boolean, authUser: any) {
    const userId = String(authUser?.id || authUser?.sub || '').trim();
    if (!userId) throw new UnauthorizedException('Authentication required');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { customer: { select: { id: true } } },
    });
    if (!user?.customer?.id) throw new NotFoundException('Customer profile not found');
    return this.customerVirtualAccounts.verifyCustomerIdentity(
      user.customer.id, type, value, consentConfirmed, authUser,
    );
  }

  async overrideIdentity(customerId: string, type: string, value: string, reason: string, adminUser: any) { await this.customerVirtualAccounts.ensureIdentitySchema(); const identityType = String(type || '').toUpperCase(); if (!['BVN', 'NIN'].includes(identityType)) throw new BadRequestException('Identity type must be BVN or NIN'); const digits = String(value || '').replace(/\D/g, ''); if (digits.length !== 11) throw new BadRequestException(`${identityType} must contain exactly 11 digits`); if (!reason?.trim() || reason.trim().length < 5) throw new BadRequestException('A clear override reason is required'); if (!adminUser?.id) throw new UnauthorizedException('Authenticated Super Admin required'); if (!(await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } }))) throw new NotFoundException('Customer not found'); const existingRows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT id, bvn_status AS "bvnStatus", nin_status AS "ninStatus" FROM customer_identity_verifications WHERE customer_id = $1`, customerId); const existing = existingRows[0]; const verificationId = existing?.id || randomUUID(); const previousStatus = identityType === 'BVN' ? (existing?.bvnStatus || 'NOT_VERIFIED') : (existing?.ninStatus || 'NOT_VERIFIED'); const column = identityType === 'BVN' ? 'bvn' : 'nin'; const statusColumn = identityType === 'BVN' ? 'bvn_status' : 'nin_status'; const atColumn = identityType === 'BVN' ? 'bvn_overridden_at' : 'nin_overridden_at'; const byColumn = identityType === 'BVN' ? 'bvn_override_by_user_id' : 'nin_override_by_user_id'; const emailColumn = identityType === 'BVN' ? 'bvn_override_by_email' : 'nin_override_by_email'; const reasonColumn = identityType === 'BVN' ? 'bvn_override_reason' : 'nin_override_reason'; if (existing) await this.prisma.$executeRawUnsafe(`UPDATE customer_identity_verifications SET ${column} = $1, ${statusColumn} = 'OVERRIDDEN', ${atColumn} = NOW(), ${byColumn} = $2, ${emailColumn} = $3, ${reasonColumn} = $4, updated_at = NOW() WHERE customer_id = $5`, this.maskIdentity(digits), adminUser.id, adminUser.email || null, reason.trim(), customerId); else await this.prisma.$executeRawUnsafe(`INSERT INTO customer_identity_verifications (id, customer_id, ${column}, ${statusColumn}, ${atColumn}, ${byColumn}, ${emailColumn}, ${reasonColumn}) VALUES ($1, $2, $3, 'OVERRIDDEN', NOW(), $4, $5, $6)`, verificationId, customerId, this.maskIdentity(digits), adminUser.id, adminUser.email || null, reason.trim()); await this.prisma.$executeRawUnsafe(`INSERT INTO customer_identity_override_audits (id, verification_id, identity_type, previous_status, new_status, reason, admin_user_id, admin_email) VALUES ($1, $2, $3, $4, 'OVERRIDDEN', $5, $6, $7)`, randomUUID(), verificationId, identityType, previousStatus, reason.trim(), adminUser.id, adminUser.email || null); return { message: `${identityType} override recorded`, customerId, type: identityType, status: 'OVERRIDDEN', maskedValue: this.maskIdentity(digits), reason: reason.trim(), overriddenBy: adminUser.email || adminUser.id }; }
  async remove(id: string) { await this.findOne(id); return this.prisma.customer.delete({ where: { id } }); }
}
