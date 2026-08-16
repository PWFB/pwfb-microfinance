'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import PWFBCompanyBrand from '../../components/PWFBCompanyBrand';

type Summary = {
  customers: { count: number };
  savings: { count: number; amount: number };
  loans: { count: number; amount: number };
  transactions: { count: number; amount: number };
  repayments: { count: number; amount: number };
  portfolio: { amount: number };
};

const initialSummary: Summary = {
  customers: { count: 0 },
  savings: { count: 0, amount: 0 },
  loans: { count: 0, amount: 0 },
  transactions: { count: 0, amount: 0 },
  repayments: { count: 0, amount: 0 },
  portfolio: { amount: 0 },
};

function money(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    apiRequest('/reports/summary')
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch(console.error)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const cards = [
    {
      title: 'Customers',
      value: summary.customers.count,
      detail: 'Customer records',
      icon: '👥',
      href: '/customers',
    },
    {
      title: 'Savings',
      value: money(summary.savings.amount),
      detail: `${summary.savings.count} savings records`,
      icon: '💰',
      href: '/savings',
    },
    {
      title: 'Loans',
      value: money(summary.loans.amount),
      detail: `${summary.loans.count} loan records`,
      icon: '🏦',
      href: '/loans',
    },
    {
      title: 'Transactions',
      value: money(summary.transactions.amount),
      detail: `${summary.transactions.count} transactions`,
      icon: '↔',
      href: '/transactions',
    },
  ];

  return (
    <main className="pwfb-approved-dashboard">

      <section className="pwfb-dashboard-welcome">
        <div className="pwfb-dashboard-brand">
          <PWFBCompanyBrand />
        </div>

        <div className="pwfb-dashboard-welcome-copy">
          <p>EXECUTIVE DASHBOARD</p>
          <h1>Welcome back, Super Admin</h1>
          <span>
            Here&apos;s your PWFB microfinance operations overview.
          </span>
        </div>

        <div className="pwfb-dashboard-online">
          <span className="pwfb-status-dot" />
          <div>
            <strong>System Online</strong>
            <small>Production</small>
          </div>
        </div>
      </section>

      <section className="pwfb-approved-metrics">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="pwfb-approved-metric"
          >
            <div className="pwfb-approved-metric-icon">
              {card.icon}
            </div>

            <div>
              <span>{card.title}</span>
              <strong>{loading ? '—' : card.value}</strong>
              <small>{loading ? 'Loading...' : card.detail}</small>
            </div>

            <b>→</b>
          </Link>
        ))}
      </section>

      <section className="pwfb-approved-layout">

        <div className="pwfb-approved-left">

          <div className="pwfb-approved-panel">
            <div className="pwfb-approved-heading">
              <div>
                <p>PORTFOLIO</p>
                <h2>Financial Overview</h2>
                <span>
                  Current savings, lending and repayment position.
                </span>
              </div>

              <Link href="/reports">
                View Reports
              </Link>
            </div>

            <div className="pwfb-approved-portfolio">
              <div className="pwfb-approved-portfolio-main">
                <small>Total Portfolio Value</small>

                <strong>
                  {loading ? '—' : money(summary.portfolio.amount)}
                </strong>

                <span>
                  Combined customer savings and loan portfolio
                </span>
              </div>

              <div className="pwfb-approved-mini-stats">
                <div>
                  <small>Repayments</small>
                  <strong>
                    {loading ? '—' : money(summary.repayments.amount)}
                  </strong>
                </div>

                <div>
                  <small>Transactions</small>
                  <strong>
                    {loading ? '—' : money(summary.transactions.amount)}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="pwfb-approved-panel">
            <div className="pwfb-approved-heading">
              <div>
                <p>QUICK ACTIONS</p>
                <h2>Common Operations</h2>
              </div>
            </div>

            <div className="pwfb-approved-actions">
              <Link href="/customers/add">
                <strong>Add Customer</strong>
                <span>Create a new customer record</span>
              </Link>

              <Link href="/savings/add">
                <strong>New Deposit</strong>
                <span>Post a savings deposit</span>
              </Link>

              <Link href="/loans/add">
                <strong>Create Loan</strong>
                <span>Start a new loan record</span>
              </Link>

              <Link href="/repayments/add">
                <strong>Record Repayment</strong>
                <span>Post a loan repayment</span>
              </Link>
            </div>
          </div>

        </div>

        <aside className="pwfb-approved-banking">

          <div className="pwfb-approved-heading">
            <div>
              <p>FINANCE OPERATIONS</p>
              <h2>Banking Operations</h2>
              <span>
                Open the financial operation you need.
              </span>
            </div>
          </div>

          <div className="pwfb-approved-banking-list">

            <Link href="/banking">
              <strong>Banking Operations</strong>
              <span>Overview and banking activity</span>
              <b>→</b>
            </Link>

            <Link href="/savings/add">
              <strong>Deposit</strong>
              <span>Record a customer deposit</span>
              <b>→</b>
            </Link>

            <Link href="/transactions/add">
              <strong>Withdrawal</strong>
              <span>Record a withdrawal transaction</span>
              <b>→</b>
            </Link>

            <Link href="/transactions/add">
              <strong>Transfer</strong>
              <span>Record a financial transfer</span>
              <b>→</b>
            </Link>

            <Link href="/periods">
              <strong>Financial Periods</strong>
              <span>Manage accounting periods</span>
              <b>→</b>
            </Link>

            <Link href="/payroll">
              <strong>Payroll &amp; Summary</strong>
              <span>Review payroll operations</span>
              <b>→</b>
            </Link>

            <Link href="/cashbook">
              <strong>Cashbook &amp; Summary</strong>
              <span>Review cash movement</span>
              <b>→</b>
            </Link>

            <Link href="/collections">
              <strong>Daily Collections &amp; Summary</strong>
              <span>Review collection activity</span>
              <b>→</b>
            </Link>

          </div>
        </aside>

      </section>
    </main>
  );
}
