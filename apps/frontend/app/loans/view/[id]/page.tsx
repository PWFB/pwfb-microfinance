'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ViewLoanPage() {
  const { id } = useParams();

  const [loan, setLoan] = useState<any>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/loans/${id}`)
      .then((res) => res.json())
      .then((data) => setLoan(data))
      .catch(console.error);
  }, [id]);

  if (!loan) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Loan Details</h1>

      <div className="space-y-3">
        <p><strong>Customer ID:</strong> {loan.customerId}</p>
        <p><strong>Amount:</strong> {loan.amount}</p>
        <p><strong>Interest Rate:</strong> {loan.interestRate ?? '-'}</p>
        <p><strong>Status:</strong> {loan.status ?? 'Pending'}</p>
        <p><strong>Created:</strong> {loan.createdAt}</p>
      </div>
    </div>
  );
}
