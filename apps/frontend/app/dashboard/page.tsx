'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Summary = {
  customers: {
    count: number;
  };
  savings: {
    count: number;
    amount: number;
  };
  loans: {
    count: number;
    amount: number;
  };
  transactions: {
    count: number;
    amount: number;
  };
  repayments: {
    count: number;
    amount: number;
  };
  portfolio: {
    amount: number;
  };
};

const initialSummary: Summary = {
  customers: { count: 0 },
  savings: { count: 0, amount: 0 },
  loans: { count: 0, amount: 0 },
  transactions: { count: 0, amount: 0 },
  repayments: { count: 0, amount: 0 },
  portfolio: { amount: 0 },
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    apiRequest('/reports/summary')
      .then((data) => {
        if (active) {
          setSummary(data);
          setError('');
        }
      })
      .catch((err) => {
        console.error(err);

        if (active) {
          setError(err.message || 'Unable to load dashboard data.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const cards = [
    {
      title: 'Clients',
      count: summary.customers.count,
      amount: summary.portfolio.amount,
      label: 'Portfolio value',
      href: '/customers',
      icon: '👥',
    },
    {
      title: 'Savings',
      count: summary.savings.count,
      amount: summary.savings.amount,
      label: 'Total savings',
      href: '/savings',
      icon: '💰',
    },
    {
      title: 'Loans',
      count: summary.loans.count,
      amount: summary.loans.amount,
      label: 'Loan portfolio',
      href: '/loans',
      icon: '🏦',
    },
    {
      title: 'Repayments',
      count: summary.repayments.count,
      amount: summary.repayments.amount,
      label: 'Total repayments',
      href: '/repayments',
      icon: '↩️',
    },
    {
      title: 'Transactions',
      count: summary.transactions.count,
      amount: summary.transactions.amount,
      label: 'Transaction value',
      href: '/transactions',
      icon: '↔️',
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
                PWFB Microfinance
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                Main Dashboard
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Real-time overview of your microfinance operations.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white px-5 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Access
              </p>
              <p className="mt-1 font-semibold text-emerald-700">
                Super Admin
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-8 rounded-3xl bg-gradient-to-r from-emerald-700 to-green-600 p-6 text-white shadow-lg sm:p-8">
          <p className="text-sm font-medium text-emerald-100">
            Client Portfolio
          </p>

          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold sm:text-4xl">
                {loading ? 'Loading...' : formatAmount(summary.portfolio.amount)}
              </h2>

              <p className="mt-2 text-sm text-emerald-100">
                Combined savings and loan portfolio value
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-emerald-100">
                Clients
              </p>
              <p className="mt-1 text-2xl font-bold">
                {loading ? '—' : summary.customers.count}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                  {card.icon}
                </div>

                <span className="text-slate-300 transition group-hover:text-emerald-600">
                  →
                </span>
              </div>

              <p className="mt-6 text-sm font-semibold text-slate-500">
                {card.title}
              </p>

              <p className="mt-1 text-3xl font-bold text-slate-900">
                {loading ? '—' : card.count}
              </p>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {card.label}
                </p>

                <p className="mt-1 text-lg font-bold text-emerald-700">
                  {loading ? 'Loading...' : formatAmount(card.amount)}
                </p>
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Operations
          </h2>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Link
              href="/customers"
              className="rounded-2xl bg-slate-50 p-4 text-center font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Customers
            </Link>

            <Link
              href="/staff-dashboard"
              className="rounded-2xl bg-slate-50 p-4 text-center font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Staff
            </Link>

            <Link
              href="/branches"
              className="rounded-2xl bg-slate-50 p-4 text-center font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Branches
            </Link>

            <Link
              href="/reports"
              className="rounded-2xl bg-slate-50 p-4 text-center font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Reports
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
