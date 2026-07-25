import { Injectable } from '@nestjs/common';

@Injectable()
export class ReportsService {
  getSummary() {
    return {
      totalCustomers: 0,
      totalSavings: 0,
      totalLoans: 0,
      totalTransactions: 0,
      totalRepayments: 0,
    };
  }
}
