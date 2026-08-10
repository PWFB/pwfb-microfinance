import { Injectable } from '@nestjs/common';
import { StaffRepository } from './staff.repository';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffFilterDto } from './dto/staff-filter.dto';

@Injectable()
export class StaffService {
  constructor(
    private readonly staffRepository: StaffRepository,
  ) {}

  create(createStaffDto: CreateStaffDto) {
    return this.staffRepository.create(
      createStaffDto,
    );
  }

  async findAll(filter?: StaffFilterDto) {
    const staff =
      await this.staffRepository.findAll();

    if (!filter) {
      return staff;
    }

    return staff.filter((member) => {
      const departmentMatch =
        !filter.department ||
        member.department.name === filter.department;

      const branchMatch =
        !filter.branch ||
        member.branch.name === filter.branch;

      const statusMatch =
        !filter.employmentStatus ||
        member.employmentStatus ===
          filter.employmentStatus;

      const searchMatch =
        !filter.search ||
        `${member.firstName} ${member.lastName}`
          .toLowerCase()
          .includes(
            filter.search.toLowerCase(),
          );

      return (
        departmentMatch &&
        branchMatch &&
        statusMatch &&
        searchMatch
      );
    });
  }

  findOne(id: string) {
    return this.staffRepository.findOne(id);
  }

  update(
    id: string,
    updateStaffDto: UpdateStaffDto,
  ) {
    return this.staffRepository.update(
      id,
      updateStaffDto,
    );
  }

  remove(id: string) {
    return this.staffRepository.remove(id);
  }
}
