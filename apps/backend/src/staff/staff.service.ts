import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { StaffRepository } from './staff.repository';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffFilterDto } from './dto/staff-filter.dto';

@Injectable()
export class StaffService {
  constructor(
    private readonly staffRepository: StaffRepository,
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

    while (await this.staffRepository.emailExists(email)) {
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

  private async generateStaffId() {
    const count = await this.staffRepository.count();
    let number = count + 1;

    let staffId = `PWFB-STF-${String(number).padStart(4, '0')}`;

    while (await this.staffRepository.staffIdExists(staffId)) {
      number++;
      staffId = `PWFB-STF-${String(number).padStart(4, '0')}`;
    }

    return staffId;
  }

  async create(createStaffDto: CreateStaffDto) {
    const email = await this.generateLoginEmail(
      createStaffDto.firstName,
      createStaffDto.lastName,
    );

    const temporaryPassword =
      this.generateTemporaryPassword();

    const password = await bcrypt.hash(
      temporaryPassword,
      10,
    );

    const staffId =
      createStaffDto.staffId ||
      (await this.generateStaffId());

    try {
      const result =
        await this.staffRepository.createWithUser(
          createStaffDto,
          {
            staffId,
            email,
            password,
          },
        );

      return {
        message: 'Staff created successfully',
        staff: result.staff,
        login: {
          email,
          temporaryPassword,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Unable to create staff',
      );
    }
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
          .includes(filter.search.toLowerCase());

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
