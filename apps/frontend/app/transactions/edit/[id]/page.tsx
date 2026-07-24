'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function EditTransactionPage() {
  const { id } = useParams();
  const router = useRouter();

  const [customerId, setCustomerId] = useState('');
  const [type, setType] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setCustomerId(data.customerId);
        setType(data.type);
        setAmount(String(data.amount));
        setDescription(data.description ?? '');
      })
      .catch(console.error);
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions/${id}`, {
      method: 'PATCH',
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
      <h1 className="text-3xl font-bold mb-6">
        Edit Transaction
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">

        <input
          className="w-full border p-2 rounded"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          value={type}
          onChange={(e) => setType(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <textarea
          className="w-full border p-2 rounded"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Update Transaction
        </button>

      </form>
    </div>
  );
}
