'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddLoanPage() {
  const router = useRouter();

  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [status, setStatus] = useState('Pending');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/loans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId,
        amount: Number(amount),
        interestRate: Number(interestRate),
        status,
      }),
    });

    router.push('/loans');
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Add Loan</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full border p-2 rounded"
          placeholder="Customer ID"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          type="number"
          placeholder="Loan Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          type="number"
          placeholder="Interest Rate"
          value={interestRate}
          onChange={(e) => setInterestRate(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          placeholder="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />

        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          type="submit"
        >
          Save Loan
        </button>
      </form>
    </div>
  );
}
