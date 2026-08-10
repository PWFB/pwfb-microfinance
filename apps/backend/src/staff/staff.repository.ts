import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  create(data: CreateStaffDto) {
    return this.prisma.staff.create({
      data: {
        staffId: data.staffId,

        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,

        email: data.email,
        phone: data.phone,

        position: data.position,

        employmentStatus:
          data.employmentStatus ?? 'ACTIVE',

        department: {
          connect: {
            id: data.department,
          },
        },

        branch: {
          connect: {
            id: data.branch,
          },
        },
      },

      include: {
        department: true,
        branch: true,
      },
    });
  }

  findAll() {
    return this.prisma.staff.findMany({
      include: {
        department: true,
        branch: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.staff.findUnique({
      where: {
        id,
      },
      include: {
        department: true,
        branch: true,
      },
    });
  }

  async update(
    id: string,
    data: UpdateStaffDto,
  ) {
    const updateData: any = {
      ...data,
    };

    delete updateData.department;
    delete updateData.branch;

    return this.prisma.staff.update({
      where: {
        id,
      },

      data: updateData,

      include: {
        department: true,
        branch: true,
      },
    });
  }

  remove(id: string) {
    return this.prisma.staff.delete({
      where: {
        id,
      },
    });
  }
}
