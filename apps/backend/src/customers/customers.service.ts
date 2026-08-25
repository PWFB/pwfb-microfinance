import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private normalizeName(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '');
  }

  private async generateLoginEmail(
    firstName: string,
    lastName: string,
  ) {
    const base = `${this.normalizeName(firstName)}.${this.normalizeName(lastName)}`;
    let email = `${base}@pwfb.com`;
    let counter = 1;

    while (
      await this.prisma.user.findUnique({
        where: { email },
      })
    ) {
      email = `${base}${counter}@pwfb.com`;
      counter++;
    }

    return email;
  }

  private generateTemporaryPassword() {
    return `PWFB-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  private async generateCustomerId() {
    const count = await this.prisma.customer.count();
    let number = count + 1;
    let customerId = `PWFB-CUS-${String(number).padStart(4, '0')}`;

    while (
      await this.prisma.customer.findUnique({
        where: { id: customerId },
      })
    ) {
      number++;
      customerId = `PWFB-CUS-${String(number).padStart(4, '0')}`;
    }

    return customerId;
  }

  async create(createCustomerDto: CreateCustomerDto, authUser: any) {
    const staff = await this.prisma.staff.findUnique({
      where: { userId: authUser.id },
      include: { branch: true },
    });

    if (!staff) {
      throw new UnauthorizedException(
        'Staff account is not linked to a staff record',
      );
    }

    const customerId = await this.generateCustomerId();
    const email = await this.generateLoginEmail(
      createCustomerDto.firstName,
      createCustomerDto.lastName,
    );
    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        let group: {
          id: string;
          name: string;
          branchId: string | null;
          createdAt: Date;
          updatedAt: Date;
        } | null = null;

        if (createCustomerDto.groupId) {
          group = await tx.clientGroup.findUnique({
            where: { id: createCustomerDto.groupId },
          });

          if (!group) {
            throw new BadRequestException('Client group not found');
          }

          if (group.branchId && group.branchId !== staff.branchId) {
            throw new BadRequestException(
              'Client group belongs to another branch',
            );
          }
        }

        const customer = await tx.customer.create({
          data: {
            id: customerId,
            firstName: createCustomerDto.firstName,
            lastName: createCustomerDto.lastName,
            email,
            phone: createCustomerDto.phone,
            address: createCustomerDto.address,
            dateOfBirth: createCustomerDto.dateOfBirth
              ? new Date(createCustomerDto.dateOfBirth)
              : undefined,
            branch: { connect: { id: staff.branchId } },
            assignedStaff: { connect: { id: staff.id } },
            ...(createCustomerDto.groupId
              ? { clientGroup: { connect: { id: createCustomerDto.groupId } } }
              : {}),
          },
        });

        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName: createCustomerDto.firstName,
            lastName: createCustomerDto.lastName,
            phone: createCustomerDto.phone,
            role: 'CUSTOMER',
            customer: { connect: { id: customer.id } },
          },
        });

        return { customer, user };
      });

      return {
        message: 'Client created successfully',
        client: {
          id: result.customer.id,
          customerId: result.customer.id,
          firstName: result.customer.firstName,
          lastName: result.customer.lastName,
          email: result.customer.email,
          branchId: result.customer.branchId,
          assignedStaffId: result.customer.assignedStaffId,
          groupId: result.customer.groupId,
        },
        login: { email, temporaryPassword },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Unable to create client',
      );
    }
  }

  async findMe(authUser: any) {
    if (!authUser?.id) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: authUser.id },
      include: {
        customer: {
          include: {
            savings: true,
            loans: true,
            transactions: true,
            branch: true,
            bankAccounts: { include: { institution: true } },
            virtualAccounts: { include: { institution: true, branch: true } },
            wallet: true,
          },
        },
      },
    });

    if (!user?.customer) {
      throw new NotFoundException('Customer profile not found');
    }

    return user.customer;
  }

  async findAll(authUser?: any) {
    const staff = authUser
      ? await this.prisma.staff.findUnique({
          where: { userId: authUser.id },
        })
      : null;

    const where = staff ? { assignedStaffId: staff.id } : undefined;

    return this.prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        savings: true,
        loans: true,
        transactions: true,
        branch: true,
        assignedStaff: true,
        clientGroup: true,
        bankAccounts: { include: { institution: true } },
        virtualAccounts: { include: { institution: true, branch: true } },
        wallet: true,
      },
    });
  }

  async findOne(id: string, authUser?: any) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        savings: true,
        loans: true,
        transactions: true,
        branch: true,
        assignedStaff: true,
        clientGroup: true,
        bankAccounts: { include: { institution: true } },
        virtualAccounts: { include: { institution: true, branch: true } },
        wallet: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (authUser) {
      const staff = await this.prisma.staff.findUnique({
        where: { userId: authUser.id },
      });

      if (staff && customer.assignedStaffId !== staff.id) {
        throw new UnauthorizedException(
          'You can only access your assigned clients',
        );
      }
    }

    return customer;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (updateCustomerDto.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: updateCustomerDto.branchId },
      });
      if (!branch) throw new BadRequestException('Branch not found');
    }

    if (updateCustomerDto.assignedStaffId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: updateCustomerDto.assignedStaffId },
      });
      if (!staff) throw new BadRequestException('Assigned staff not found');
    }

    if (updateCustomerDto.groupId) {
      const group = await this.prisma.clientGroup.findUnique({
        where: { id: updateCustomerDto.groupId },
      });
      if (!group) throw new BadRequestException('Client group not found');
    }

    const firstName = updateCustomerDto.firstName ?? customer.firstName;
    const lastName = updateCustomerDto.lastName ?? customer.lastName;
    const email = updateCustomerDto.email ?? customer.email;
    const phone = updateCustomerDto.phone ?? customer.phone;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: {
          firstName,
          lastName,
          email,
          phone,
          address: updateCustomerDto.address,
          dateOfBirth: updateCustomerDto.dateOfBirth
            ? new Date(updateCustomerDto.dateOfBirth)
            : undefined,
          branchId: updateCustomerDto.branchId,
          assignedStaffId: updateCustomerDto.assignedStaffId,
          groupId: updateCustomerDto.groupId,
        },
      });

      if (customer.userId) {
        await tx.user.update({
          where: { id: customer.userId },
          data: {
            ...(email ? { email } : {}),
            firstName,
            lastName,
            phone,
          },
        });
      }

      return updatedCustomer;
    });

    return {
      message: 'Customer profile updated successfully',
      customer: updated,
    };
  }

  async resetPassword(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!customer?.user) {
      throw new NotFoundException('Customer login account not found');
    }

    const temporaryPassword = `PWFB-${randomBytes(5)
      .toString('hex')
      .toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const password = await bcrypt.hash(temporaryPassword, 10);

    await this.prisma.user.update({
      where: { id: customer.user.id },
      data: { password },
    });

    return {
      message: 'Customer password reset successfully',
      customerId: customer.id,
      loginEmail: customer.user.email,
      temporaryPassword,
      note: 'For security, PWFB never stores or displays the previous plaintext password. This temporary password should be delivered securely to the customer and changed after login.',
    };
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.customer.delete({ where: { id } });
  }
}
