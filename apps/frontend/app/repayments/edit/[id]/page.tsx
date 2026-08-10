'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function EditRepaymentPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loanId, setLoanId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/repayments/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setLoanId(data.loanId);
        setAmount(String(data.amount));
        setMethod(data.method ?? '');
        setNotes(data.notes ?? '');
      })
      .catch(console.error);
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/repayments/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        loanId,
        amount: Number(amount),
        method,
        notes,
      }),
    });

    router.push('/repayments');
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Edit Repayment
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">

        <input
          className="w-full border p-2 rounded"
          value={loanId}
          onChange={(e) => setLoanId(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        />

        <textarea
          className="w-full border p-2 rounded"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Update Repayment
        </button>

      </form>
    </div>
  );
}
