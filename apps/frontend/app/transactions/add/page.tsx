'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddTransactionPage() {
  const router = useRouter();

  const [customerId, setCustomerId] = useState('');
  const [type, setType] = useState('Deposit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId,
        type,
        amount: Number(amount),
        description,
      }),
    });

    router.push('/transactions');
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Add Transaction</h1>

      <form onSubmit={handleSubmit} className="space-y-4">

        <input
          className="w-full border p-2 rounded"
          placeholder="Customer ID"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />

        <select
          className="w-full border p-2 rounded"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option>Deposit</option>
          <option>Withdrawal</option>
          <option>Loan Disbursement</option>
          <option>Loan Repayment</option>
        </select>

        <input
          className="w-full border p-2 rounded"
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <textarea
          className="w-full border p-2 rounded"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Save Transaction
        </button>

      </form>
    </div>
  );
}
