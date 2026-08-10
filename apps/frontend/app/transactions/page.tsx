'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Transaction {
  id: string;
  customerId: string;
  type: string;
  amount: number;
  description?: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions`)
      .then((res) => res.json())
      .then((data) => setTransactions(data))
      .catch(console.error);
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Transactions</h1>

        <Link
          href="/transactions/add"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Add Transaction
        </Link>
      </div>

      <table className="w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">Customer</th>
            <th className="border p-2">Type</th>
            <th className="border p-2">Amount</th>
            <th className="border p-2">Description</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>

        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td className="border p-2">{transaction.customerId}</td>
              <td className="border p-2">{transaction.type}</td>
              <td className="border p-2">{transaction.amount}</td>
              <td className="border p-2">
                {transaction.description ?? '-'}
              </td>
              <td className="border p-2">
                <div className="flex gap-3">
                  <Link
                    href={`/transactions/view/${transaction.id}`}
                    className="text-blue-600"
                  >
                    View
                  </Link>

                  <Link
                    href={`/transactions/edit/${transaction.id}`}
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
