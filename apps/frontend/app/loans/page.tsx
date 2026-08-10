'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Loan {
  id: string;
  customerId: string;
  amount: number;
  interestRate?: number;
  status?: string;
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/loans`)
      .then((res) => res.json())
      .then((data) => setLoans(data))
      .catch(console.error);
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Loans</h1>

        <Link
          href="/loans/add"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Add Loan
        </Link>
      </div>

      <table className="w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">Customer</th>
            <th className="border p-2">Amount</th>
            <th className="border p-2">Interest</th>
            <th className="border p-2">Status</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>

        <tbody>
          {loans.map((loan) => (
            <tr key={loan.id}>
              <td className="border p-2">{loan.customerId}</td>
              <td className="border p-2">{loan.amount}</td>
              <td className="border p-2">
                {loan.interestRate ?? '-'}
              </td>
              <td className="border p-2">
                {loan.status ?? 'Pending'}
              </td>
              <td className="border p-2">
                <div className="flex gap-3">
                  <Link
                    href={`/loans/view/${loan.id}`}
                    className="text-blue-600"
                  >
                    View
                  </Link>

                  <Link
                    href={`/loans/edit/${loan.id}`}
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
