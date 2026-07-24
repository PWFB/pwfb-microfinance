export enum StaffStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export class StaffEntity {
  id: string;

  staffId: string;

  firstName: string;

  middleName?: string;

  lastName: string;

  email: string;

  phone: string;

  department: string;

  position: string;

  branch: string;

  employmentStatus: StaffStatus;

  createdAt: Date;

  updatedAt: Date;
}
