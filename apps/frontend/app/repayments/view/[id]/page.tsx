'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ViewRepaymentPage() {
  const { id } = useParams();

  const [repayment, setRepayment] = useState<any>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/repayments/${id}`)
      .then((res) => res.json())
      .then((data) => setRepayment(data))
      .catch(console.error);
  }, [id]);

  if (!repayment) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Repayment Details
      </h1>

      <div className="space-y-3">
        <p><strong>Loan ID:</strong> {repayment.loanId}</p>
        <p><strong>Amount:</strong> {repayment.amount}</p>
        <p>
          <strong>Payment Date:</strong>{' '}
          {new Date(repayment.paymentDate).toLocaleDateString()}
        </p>
        <p><strong>Method:</strong> {repayment.method ?? '-'}</p>
        <p><strong>Notes:</strong> {repayment.notes ?? '-'}</p>
        <p>
          <strong>Created:</strong>{' '}
          {new Date(repayment.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
