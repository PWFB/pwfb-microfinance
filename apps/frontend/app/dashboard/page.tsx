'use client';

import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [summary, setSummary] = useState({
    totalCustomers: 0,
    totalSavings: 0,
    totalLoans: 0,
    totalTransactions: 0,
    totalRepayments: 0,
  });

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/summary`)
      .then((res) => res.json())
      .then((data) => setSummary(data))
      .catch((err) => console.error(err));
  }, []);

  const cards = [
    {
      title: 'Customers',
      value: summary.totalCustomers,
    },
    {
      title: 'Savings',
      value: summary.totalSavings,
    },
    {
      title: 'Loans',
      value: summary.totalLoans,
    },
    {
      title: 'Transactions',
      value: summary.totalTransactions,
    },
    {
      title: 'Repayments',
      value: summary.totalRepayments,
    },
  ];

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {cards.map((card) => (
          <div
            key={card.title}
            className="border rounded-lg p-6 shadow"
          >
            <h2 className="text-lg font-semibold">
              {card.title}
            </h2>

            <p className="text-3xl mt-3 font-bold">
              {card.value}
            </p>
          </div>
        ))}

      </div>

    </div>
  );
}
