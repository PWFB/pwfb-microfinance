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
      title: 'Customers',
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
      icon: '₦',
    },
    {
      title: 'Loans',
      count: summary.loans.count,
      amount: summary.loans.amount,
      label: 'Loan portfolio',
      href: '/loans',
      icon: 'L',
    },
    {
      title: 'Repayments',
      count: summary.repayments.count,
      amount: summary.repayments.amount,
      label: 'Total repayments',
      href: '/repayments',
      icon: '↩',
    },
    {
      title: 'Transactions',
      count: summary.transactions.count,
      amount: summary.transactions.amount,
      label: 'Transaction value',
      href: '/transactions',
      icon: '↔',
    },
  ];

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">EXECUTIVE OVERVIEW</p>
          <h1 className="pwfb-page-title">Dashboard</h1>
          <p className="pwfb-page-description">
            Real-time overview of PWFB microfinance operations.
          </p>
        </div>

        <div className="pwfb-admin-badge">
          <span>ACCESS</span>
          <strong>Super Admin</strong>
        </div>
      </div>

      {error && (
        <div className="pwfb-alert">
          {error}
        </div>
      )}

      <section className="pwfb-dashboard-hero">
        <div>
          <p>CLIENT PORTFOLIO</p>

          <h2>
            {loading
              ? 'Loading...'
              : formatAmount(summary.portfolio.amount)}
          </h2>

          <span>
            Combined savings and loan portfolio value
          </span>
        </div>

        <div className="pwfb-dashboard-hero-stat">
          <span>Customers</span>
          <strong>
            {loading ? '—' : summary.customers.count}
          </strong>
        </div>
      </section>

      <section className="pwfb-stat-grid">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="pwfb-dashboard-card"
          >
            <div className="pwfb-dashboard-card-top">
              <div className="pwfb-dashboard-icon">
                {card.icon}
              </div>

              <span>→</span>
            </div>

            <p>{card.title}</p>

            <strong>
              {loading ? '—' : card.count}
            </strong>

            <div className="pwfb-dashboard-card-value">
              <small>{card.label}</small>
              <b>
                {loading ? 'Loading...' : formatAmount(card.amount)}
              </b>
            </div>
          </Link>
        ))}
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Quick Operations</h2>
            <p>Access the main operational areas of PWFB.</p>
          </div>
        </div>

        <div className="pwfb-quick-actions">
          <Link href="/customers" className="pwfb-quick-action">
            <strong>Customers</strong>
            <span>Manage customer records →</span>
          </Link>

          <Link href="/loans" className="pwfb-quick-action">
            <strong>Loans</strong>
            <span>Manage loan portfolio →</span>
          </Link>

          <Link href="/savings" className="pwfb-quick-action">
            <strong>Savings</strong>
            <span>Manage savings accounts →</span>
          </Link>

          <Link href="/repayments" className="pwfb-quick-action">
            <strong>Repayments</strong>
            <span>Record loan repayments →</span>
          </Link>

          <Link href="/transactions" className="pwfb-quick-action">
            <strong>Transactions</strong>
            <span>View financial activity →</span>
          </Link>

          <Link href="/staff-dashboard" className="pwfb-quick-action">
            <strong>Staff</strong>
            <span>Open staff dashboard →</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
