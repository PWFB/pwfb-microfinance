'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ViewTransactionPage() {
  const { id } = useParams();

  const [transaction, setTransaction] = useState<any>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions/${id}`)
      .then((res) => res.json())
      .then((data) => setTransaction(data))
      .catch(console.error);
  }, [id]);

  if (!transaction) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Transaction Details
      </h1>

      <div className="space-y-3">
        <p><strong>Customer ID:</strong> {transaction.customerId}</p>
        <p><strong>Type:</strong> {transaction.type}</p>
        <p><strong>Amount:</strong> {transaction.amount}</p>
        <p><strong>Description:</strong> {transaction.description ?? '-'}</p>
        <p><strong>Created:</strong> {transaction.createdAt}</p>
      </div>
    </div>
  );
}
