'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function EditLoanPage() {
  const { id } = useParams();
  const router = useRouter();

  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/loans/${id}`)
      .then((res) => res.json())
      .then((loan) => {
        setCustomerId(loan.customerId);
        setAmount(String(loan.amount));
        setInterestRate(String(loan.interestRate ?? ''));
        setStatus(loan.status ?? '');
      });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/loans/${id}`, {
      method: 'PATCH',
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
      <h1 className="text-3xl font-bold mb-6">Edit Loan</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full border p-2 rounded"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          type="number"
          value={interestRate}
          onChange={(e) => setInterestRate(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />

        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Update Loan
        </button>
      </form>
    </div>
  );
}
