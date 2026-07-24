'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Repayment {
  id: string;
  loanId: string;
  amount: number;
  paymentDate: string;
  method?: string;
}

export default function RepaymentsPage() {
  const [repayments, setRepayments] = useState<Repayment[]>([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/repayments`)
      .then((res) => res.json())
      .then((data) => setRepayments(data))
      .catch(console.error);
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Repayments</h1>

        <Link
          href="/repayments/add"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Add Repayment
        </Link>
      </div>

      <table className="w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">Loan ID</th>
            <th className="border p-2">Amount</th>
            <th className="border p-2">Payment Date</th>
            <th className="border p-2">Method</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>

        <tbody>
          {repayments.map((repayment) => (
            <tr key={repayment.id}>
              <td className="border p-2">{repayment.loanId}</td>
              <td className="border p-2">{repayment.amount}</td>
              <td className="border p-2">
                {new Date(repayment.paymentDate).toLocaleDateString()}
              </td>
              <td className="border p-2">
                {repayment.method ?? '-'}
              </td>
              <td className="border p-2">
                <div className="flex gap-3">
                  <Link
                    href={`/repayments/view/${repayment.id}`}
                    className="text-blue-600"
                  >
                    View
                  </Link>

                  <Link
                    href={`/repayments/edit/${repayment.id}`}
                    className="text-green-600"
                  >
                    Edit
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
