import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { StaffRepository } from './staff.repository';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffFilterDto } from './dto/staff-filter.dto';
import { FlutterwaveService } from '../banking/flutterwave.service';
import { StaffScopeService } from '../access/staff-scope.service';

@Injectable()
export class StaffService {
  constructor(
    private readonly staffRepository: StaffRepository,
    private readonly flutterwaveService: FlutterwaveService,
    private readonly staffScopeService: StaffScopeService,
  ) {}

  private normalizeName(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, ''); }
  private async generateLoginEmail(firstName: string, lastName: string) {
    const base = `${this.normalizeName(firstName)}.${this.normalizeName(lastName)}`;
    let email = `${base}@pwfb.com`; let counter = 1;
    while (await this.staffRepository.emailExists(email)) { email = `${base}${counter}@pwfb.com`; counter++; }
    return email;
  }
  private generateTemporaryPassword() { return `PWFB-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`; }
  private async generateStaffId() {
    const count = await this.staffRepository.count(); let number = count + 1; let staffId = `PWFB-STF-${String(number).padStart(4, '0')}`;
    while (await this.staffRepository.staffIdExists(staffId)) { number++; staffId = `PWFB-STF-${String(number).padStart(4, '0')}`; }
    return staffId;
  }
  async verifyBvn(bvn: string) { return this.flutterwaveService.verifyBvn(bvn); }

  async create(createStaffDto: CreateStaffDto) {
    let bvnVerification: any = undefined;
    let registrationData = { ...createStaffDto };
    if (createStaffDto.bvn) {
      bvnVerification = await this.flutterwaveService.verifyBvn(createStaffDto.bvn);
      if (bvnVerification.firstName) registrationData.firstName = bvnVerification.firstName;
      if (bvnVerification.middleName) registrationData.middleName = bvnVerification.middleName;
      if (bvnVerification.lastName) registrationData.lastName = bvnVerification.lastName;
    }
    const email = await this.generateLoginEmail(registrationData.firstName, registrationData.lastName);
    const temporaryPassword = this.generateTemporaryPassword();
    const password = await bcrypt.hash(temporaryPassword, 10);
    const staffId = createStaffDto.staffId || await this.generateStaffId();
    try {
      const result = await this.staffRepository.createWithUser(registrationData, { staffId, email, password }, bvnVerification);
      return { message: 'Staff created successfully', staff: result.staff, login: { email, temporaryPassword }, bvn: bvnVerification ? { verified: true, name: bvnVerification.fullName } : { verified: false } };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Unable to create staff');
    }
  }

  async findAll(filter?: StaffFilterDto, authUser?: any) {
    const staff = authUser
      ? await this.findVisible(filter, authUser)
      : await this.staffRepository.findAll();
    return staff;
  }

  async findVisible(filter: StaffFilterDto | undefined, authUser: any) {
    const where = await this.staffScopeService.staffWhere(authUser);
    const staff = await this.staffRepository.findAllWhere(where);
    if (!filter) return staff;
    return staff.filter((member) => {
      const departmentMatch = !filter.department || member.department.name === filter.department;
      const branchMatch = !filter.branch || member.branch.name === filter.branch;
      const statusMatch = !filter.employmentStatus || member.employmentStatus === filter.employmentStatus;
      const searchMatch = !filter.search || `${member.firstName} ${member.middleName ?? ''} ${member.lastName}`.toLowerCase().includes(filter.search.toLowerCase());
      return departmentMatch && branchMatch && statusMatch && searchMatch;
    });
  }

  async findOneVisible(id: string, authUser: any) {
    const where = await this.staffScopeService.staffWhere(authUser);
    const staff = await this.staffRepository.findOneWhere(id, where);
    if (!staff) throw new ForbiddenException('You do not have access to this staff member');
    return staff;
  }

  findOne(id: string) { return this.staffRepository.findOne(id); }
  update(id: string, updateStaffDto: UpdateStaffDto) { return this.staffRepository.update(id, updateStaffDto); }
  remove(id: string) { return this.staffRepository.remove(id); }

  assign(id: string, body: { role: Role; regionId?: string; divisionId?: string; areaId?: string; branchId?: string; notes?: string }) {
    return this.staffRepository.createAssignment(id, body);
  }

  async assignmentHistory(id: string, authUser?: any) {
    if (authUser) await this.findOneVisible(id, authUser);
    return this.staffRepository.assignmentHistory(id);
  }
}
