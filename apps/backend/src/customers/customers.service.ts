import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import * as bcrypt from 'bcryptjs';

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
    const base =
      `${this.normalizeName(firstName)}.${this.normalizeName(lastName)}`;

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
      .toUpperCase()}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;
  }

  private async generateCustomerId() {
    const count = await this.prisma.customer.count();

    let number = count + 1;
    let customerId =
      `PWFB-CUS-${String(number).padStart(4, '0')}`;

    while (
      await this.prisma.customer.findUnique({
        where: { id: customerId },
      })
    ) {
      number++;

      customerId =
        `PWFB-CUS-${String(number).padStart(4, '0')}`;
    }

    return customerId;
  }

  async create(
    createCustomerDto: CreateCustomerDto,
    authUser: any,
  ) {
    /*
     * A staff member creating a client must automatically
     * inherit that staff member's branch.
     */
    const staff = await this.prisma.staff.findUnique({
      where: {
        userId: authUser.id,
      },
      include: {
        branch: true,
      },
    });

    if (!staff) {
      throw new UnauthorizedException(
        'Staff account is not linked to a staff record',
      );
    }

    const customerId =
      await this.generateCustomerId();

    const email =
      await this.generateLoginEmail(
        createCustomerDto.firstName,
        createCustomerDto.lastName,
      );

    const temporaryPassword =
      this.generateTemporaryPassword();

    const hashedPassword =
      await bcrypt.hash(
        temporaryPassword,
        10,
      );

    try {
      const result =
        await this.prisma.$transaction(
          async (tx) => {
            let group: { id: string; name: string; branchId: string | null; createdAt: Date; updatedAt: Date } | null = null;

            if (createCustomerDto.groupId) {
              group =
                await tx.clientGroup.findUnique({
                  where: {
                    id: createCustomerDto.groupId,
                  },
                });

              if (!group) {
                throw new BadRequestException(
                  'Client group not found',
                );
              }

              if (
                group.branchId &&
                group.branchId !== staff.branchId
              ) {
                throw new BadRequestException(
                  'Client group belongs to another branch',
                );
              }
            }

            const customer =
              await tx.customer.create({
                data: {
                  id: customerId,

                  firstName:
                    createCustomerDto.firstName,

                  lastName:
                    createCustomerDto.lastName,

                  email,

                  phone:
                    createCustomerDto.phone,

                  address:
                    createCustomerDto.address,

                  dateOfBirth:
                    createCustomerDto.dateOfBirth
                      ? new Date(
                          createCustomerDto.dateOfBirth,
                        )
                      : undefined,

                  branch: {
                    connect: {
                      id: staff.branchId,
                    },
                  },

                  assignedStaff: {
                    connect: {
                      id: staff.id,
                    },
                  },

                  ...(createCustomerDto.groupId
                    ? {
                        clientGroup: {
                          connect: {
                            id:
                              createCustomerDto.groupId,
                          },
                        },
                      }
                    : {}),
                },
              });

            const user =
              await tx.user.create({
                data: {
                  email,
                  password: hashedPassword,

                  firstName:
                    createCustomerDto.firstName,

                  lastName:
                    createCustomerDto.lastName,

                  phone:
                    createCustomerDto.phone,

                  role: 'CUSTOMER',

                  customer: {
                    connect: {
                      id: customer.id,
                    },
                  },
                },
              });

            return {
              customer,
              user,
            };
          },
        );

      return {
        message:
          'Client created successfully',

        client: {
          id: result.customer.id,
          customerId:
            result.customer.id,

          firstName:
            result.customer.firstName,

          lastName:
            result.customer.lastName,

          email:
            result.customer.email,

          branchId:
            result.customer.branchId,

          assignedStaffId:
            result.customer.assignedStaffId,

          groupId:
            result.customer.groupId,
        },

        login: {
          email,
          temporaryPassword,
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Unable to create client',
      );
    }
  }

  async findAll(authUser?: any) {
    const staff = authUser
      ? await this.prisma.staff.findUnique({
          where: {
            userId: authUser.id,
          },
        })
      : null;

    if (staff) {
      return this.prisma.customer.findMany({
        where: {
          assignedStaffId: staff.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          savings: true,
          loans: true,
          transactions: true,
          branch: true,
          assignedStaff: true,
          clientGroup: true,
        },
      });
    }

    return this.prisma.customer.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        savings: true,
        loans: true,
        transactions: true,
        branch: true,
        assignedStaff: true,
        clientGroup: true,
      },
    });
  }

  async findOne(
    id: string,
    authUser?: any,
  ) {
    const customer =
      await this.prisma.customer.findUnique({
        where: { id },
        include: {
          savings: true,
          loans: true,
          transactions: true,
          branch: true,
          assignedStaff: true,
          clientGroup: true,
        },
      });

    if (!customer) {
      throw new NotFoundException(
        'Customer not found',
      );
    }

    if (authUser) {
      const staff =
        await this.prisma.staff.findUnique({
          where: {
            userId: authUser.id,
          },
        });

      if (
        staff &&
        customer.assignedStaffId !== staff.id
      ) {
        throw new UnauthorizedException(
          'You can only access your assigned clients',
        );
      }
    }

    return customer;
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ) {
    await this.findOne(id);

    return this.prisma.customer.update({
      where: { id },
      data: {
        firstName:
          updateCustomerDto.firstName,

        lastName:
          updateCustomerDto.lastName,

        email:
          updateCustomerDto.email,

        phone:
          updateCustomerDto.phone,

        address:
          updateCustomerDto.address,

        dateOfBirth:
          updateCustomerDto.dateOfBirth
            ? new Date(
                updateCustomerDto.dateOfBirth,
              )
            : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.customer.delete({
      where: { id },
    });
  }
}
