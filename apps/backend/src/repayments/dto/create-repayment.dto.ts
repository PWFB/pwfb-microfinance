export class CreateRepaymentDto {
  loanId: string;
  amount: number;
  paymentDate?: Date;
  method?: string;
  notes?: string;
}
