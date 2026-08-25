import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffStatus } from '@prisma/client';

@Injectable()
export class StaffRepository {
  constructor(private readonly prisma: PrismaService) {}
  async emailExists(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    const staff = await this.prisma.staff.findUnique({ where: { email }, select: { id: true } });
    return !!user || !!staff;
  }
  count() { return this.prisma.staff.count(); }
  async staffIdExists(staffId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { staffId }, select: { id: true } });
    return !!staff;
  }
  async createWithUser(data: CreateStaffDto, login: { staffId: string; email: string; password: string }, bvnVerification?: { verified: boolean; bvn: string; fullName: string }) {
    return this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.create({
        data: {
          staffId: login.staffId,
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          email: login.email,
          phone: data.phone,
          position: data.position,
          employmentStatus: data.employmentStatus ?? StaffStatus.ACTIVE,
          ...(bvnVerification?.verified ? { bvn: bvnVerification.bvn, bvnVerified: true, bvnVerifiedAt: new Date(), bvnVerifiedName: bvnVerification.fullName } : {}),
          department: { connect: { id: data.department } },
          branch: { connect: { id: data.branch } },
        },
        include: { department: true, branch: true },
      });
      const user = await tx.user.create({
        data: {
          email: login.email,
          password: login.password,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: data.role,
          staff: { connect: { id: staff.id } },
        },
      });
      return { staff, user };
    });
  }
  create(data: CreateStaffDto & { staffId: string; email: string }) {
    return this.prisma.staff.create({
      data: {
        staffId: data.staffId, firstName: data.firstName, middleName: data.middleName, lastName: data.lastName,
        email: data.email, phone: data.phone, position: data.position,
        employmentStatus: data.employmentStatus ?? StaffStatus.ACTIVE,
        ...(data.bvn ? { bvn: data.bvn } : {}),
        department: { connect: { id: data.department } }, branch: { connect: { id: data.branch } },
      },
      include: { department: true, branch: true },
    });
  }
  findAll() { return this.prisma.staff.findMany({ include: { department: true, branch: true, user: true, customers: true } }); }
  findOne(id: string) { return this.prisma.staff.findUnique({ where: { id }, include: { department: true, branch: true, user: true, customers: true } }); }
  async update(id: string, data: UpdateStaffDto) {
    const updateData: any = { ...data };
    delete updateData.department;
    delete updateData.branch;
    return this.prisma.staff.update({ where: { id }, data: updateData, include: { department: true, branch: true, user: true, customers: true } });
  }
  remove(id: string) { return this.prisma.staff.delete({ where: { id } }); }
}
