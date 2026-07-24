import { StaffStatus } from '../entities/staff.entity';

export interface StaffInterface {
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
