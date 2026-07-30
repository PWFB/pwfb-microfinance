export class CreateCustomerDto {
  customerNumber?: string;

  firstName: string;
  middleName?: string;
  lastName: string;

  gender?: string;
  dateOfBirth?: string;

  phone: string;
  email?: string;

  address?: string;
  occupation?: string;

  nationalId?: string;

  nextOfKinName?: string;
  nextOfKinPhone?: string;

  branchId?: string;

  status?: string;
}
