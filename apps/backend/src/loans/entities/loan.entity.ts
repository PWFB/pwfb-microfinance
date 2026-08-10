export class LoanEntity {
  id: string;

  customerId: string;

  amount: number;

  interestRate?: number;

  status?: string;

  createdAt: Date;

  updatedAt: Date;
}
