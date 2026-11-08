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

  async createWithUser(
    data: CreateStaffDto,
    login: { staffId: string; email: string; password: string },
    bvnVerification?: { verified: boolean; bvn: string; fullName: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const departmentValue = String(data.department || '').trim();
      if (!departmentValue) throw new Error('Department is required');

      const departmentById = await tx.department.findUnique({ where: { id: departmentValue } });
      const department = departmentById ?? await tx.department.upsert({
        where: { name: departmentValue }, update: {}, create: { name: departmentValue },
      });

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
          ...(bvnVerification?.verified ? {
            bvn: bvnVerification.bvn,
            bvnVerified: true,
            bvnVerifiedAt: new Date(),
            bvnVerifiedName: bvnVerification.fullName,
          } : {}),
          department: { connect: { id: department.id } },
          branch: { connect: { id: data.branch } },
          ...(data.regionId ? { region: { connect: { id: data.regionId } } } : {}),
          ...(data.divisionId ? { division: { connect: { id: data.divisionId } } } : {}),
          ...(data.areaId ? { area: { connect: { id: data.areaId } } } : {}),
        },
        include: { department: true, branch: true, region: true, division: true, area: true },
      });

      await tx.staffAssignment.create({
        data: {
          staffId: staff.id,
          role: data.role,
          regionId: data.regionId,
          divisionId: data.divisionId,
          areaId: data.areaId,
          branchId: data.branch,
          active: true,
          startsAt: new Date(),
        },
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

      // Every newly-created Branch Manager receives a persistent PWFB branch account.
      // The account is generated once and remains attached to the branch.
      if (String(data.role) === 'BRANCH_MANAGER') {
        const institution = await tx.bankInstitution.findFirst({
          where: { active: true },
          orderBy: { createdAt: 'asc' },
        });
        if (institution) {
          const existing = await tx.branchVirtualAccount.findUnique({
            where: { branchId_institutionId: { branchId: data.branch, institutionId: institution.id } },
          });
          if (!existing) {
            let accountNumber = '';
            do {
              accountNumber = `9${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 10)}`;
            } while (await tx.branchVirtualAccount.findUnique({ where: { accountNumber } }));
            await tx.branchVirtualAccount.create({
              data: {
                branchId: data.branch,
                institutionId: institution.id,
                accountNumber,
                accountName: `PWFB - ${staff.branch.name}`,
                isGenerated: true,
                generatedAt: new Date(),
              },
            });
          }
        }
      }

      return { staff, user };
    });
  }

  create(data: CreateStaffDto & { staffId: string; email: string }) {
    return this.prisma.staff.create({
      data: {
        staffId: data.staffId,
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        position: data.position,
        employmentStatus: data.employmentStatus ?? StaffStatus.ACTIVE,
        ...(data.bvn ? { bvn: data.bvn } : {}),
        department: { connect: { id: data.department } },
        branch: { connect: { id: data.branch } },
        ...(data.regionId ? { region: { connect: { id: data.regionId } } } : {}),
        ...(data.divisionId ? { division: { connect: { id: data.divisionId } } } : {}),
        ...(data.areaId ? { area: { connect: { id: data.areaId } } } : {}),
      },
      include: { department: true, branch: true, region: true, division: true, area: true },
    });
  }

  findAll() {
    return this.prisma.staff.findMany({
      include: {
        department: true, branch: true, region: true, division: true, area: true,
        user: true, customers: true,
        assignments: { orderBy: { startsAt: 'desc' }, include: { region: true, division: true, area: true, branch: true } },
      },
    });
  }

  findOne(id: string) {
    return this.prisma.staff.findUnique({
      where: { id },
      include: {
        department: true, branch: true, region: true, division: true, area: true,
        user: true, customers: true,
        assignments: { orderBy: { startsAt: 'desc' }, include: { region: true, division: true, area: true, branch: true } },
      },
    });
  }

  async update(id: string, data: UpdateStaffDto) {
    const updateData: any = { ...data };
    delete updateData.department; delete updateData.branch; delete updateData.regionId; delete updateData.divisionId; delete updateData.areaId;
    return this.prisma.staff.update({
      where: { id }, data: updateData,
      include: { department: true, branch: true, region: true, division: true, area: true, user: true, customers: true, assignments: { orderBy: { startsAt: 'desc' } } },
    });
  }

  remove(id: string) { return this.prisma.staff.delete({ where: { id } }); }

  createAssignment(staffId: string, data: { role: any; regionId?: string; divisionId?: string; areaId?: string; branchId?: string; notes?: string }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.staffAssignment.updateMany({ where: { staffId, active: true }, data: { active: false, endsAt: new Date() } });
      const assignment = await tx.staffAssignment.create({
        data: { staffId, role: data.role, regionId: data.regionId, divisionId: data.divisionId, areaId: data.areaId, branchId: data.branchId, notes: data.notes },
        include: { region: true, division: true, area: true, branch: true },
      });
      await tx.staff.update({ where: { id: staffId }, data: { regionId: data.regionId, divisionId: data.divisionId, areaId: data.areaId, ...(data.branchId ? { branchId: data.branchId } : {}) } });
      await tx.user.updateMany({ where: { staffId }, data: { role: data.role } });
      return assignment;
    });
  }

  assignmentHistory(staffId: string) {
    return this.prisma.staffAssignment.findMany({ where: { staffId }, orderBy: { startsAt: 'desc' }, include: { region: true, division: true, area: true, branch: true } });
  }
}
