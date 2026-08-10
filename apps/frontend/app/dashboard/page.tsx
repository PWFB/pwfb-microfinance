'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

export default function DashboardPage() {
  const [summary, setSummary] = useState({
    totalCustomers: 0,
    totalSavings: 0,
    totalLoans: 0,
    totalTransactions: 0,
    totalRepayments: 0,
  });

  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/reports/summary')
      .then((data) => {
        setSummary(data);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Unable to load dashboard');
      });
  }, []);

  const cards = [
    { title: 'Customers', value: summary.totalCustomers },
    { title: 'Savings', value: summary.totalSavings },
    { title: 'Loans', value: summary.totalLoans },
    { title: 'Transactions', value: summary.totalTransactions },
    { title: 'Repayments', value: summary.totalRepayments },
  ];

  return (
    <main className="p-6">
      <h1 className="mb-6 text-3xl font-bold">
        Dashboard
      </h1>

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 p-4 text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-lg border p-6 shadow"
          >
            <h2 className="text-lg font-semibold">
              {card.title}
            </h2>

            <p className="mt-3 text-3xl font-bold">
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
