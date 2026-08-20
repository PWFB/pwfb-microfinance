'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

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

  return (
    <main className="pwfb-reference-dashboard">
      <header className="pwfb-reference-header">
        <div>
          <p className="pwfb-eyebrow">PWFB MICROFINANCE</p>
          <h1>Dashboard</h1>
          <span>Welcome back, Super Admin</span>
        </div>

        <div className="pwfb-header-actions">
          <button type="button" aria-label="Search">⌕</button>
          <button type="button" aria-label="Notifications">🔔</button>
          <div className="pwfb-admin-chip">
            <div className="pwfb-avatar">SA</div>
            <div>
              <strong>Super Admin</strong>
              <small>Administrator</small>
            </div>
          </div>
        </div>
      </header>

      <section className="pwfb-reference-stats">
        <Link href="/customers" className="pwfb-stat-card">
          <div className="pwfb-stat-icon green">👥</div>
          <div>
            <small>Total Customers</small>
            <strong>{loading ? '—' : summary.customers.count}</strong>
            <span>Active customer accounts</span>
          </div>
        </Link>

        <Link href="/savings" className="pwfb-stat-card">
          <div className="pwfb-stat-icon orange">₦</div>
          <div>
            <small>Total Savings</small>
            <strong>{loading ? '—' : money(summary.savings.amount)}</strong>
            <span>{summary.savings.count} savings records</span>
          </div>
        </Link>

        <Link href="/loans" className="pwfb-stat-card">
          <div className="pwfb-stat-icon green">▣</div>
          <div>
            <small>Loan Portfolio</small>
            <strong>{loading ? '—' : money(summary.loans.amount)}</strong>
            <span>{summary.loans.count} loan records</span>
          </div>
        </Link>

        <Link href="/repayments" className="pwfb-stat-card">
          <div className="pwfb-stat-icon orange">↗</div>
          <div>
            <small>Repayments</small>
            <strong>{loading ? '—' : money(summary.repayments.amount)}</strong>
            <span>{summary.repayments.count} repayments</span>
          </div>
        </Link>
      </section>

      <section className="pwfb-reference-grid">
        <div className="pwfb-reference-main">
          <div className="pwfb-reference-panel">
            <div className="pwfb-panel-heading">
              <div>
                <small>FINANCIAL PERFORMANCE</small>
                <h2>Portfolio Overview</h2>
              </div>
              <Link href="/reports">View Reports →</Link>
            </div>

            <div className="pwfb-portfolio-summary">
              <div>
                <span>Total Portfolio</span>
                <strong>{loading ? '—' : money(summary.portfolio.amount)}</strong>
              </div>

              <div className="pwfb-summary-item">
                <span>Savings</span>
                <strong>{loading ? '—' : money(summary.savings.amount)}</strong>
              </div>

              <div className="pwfb-summary-item">
                <span>Loans</span>
                <strong>{loading ? '—' : money(summary.loans.amount)}</strong>
              </div>
            </div>

            <div className="pwfb-chart">
              <div className="pwfb-chart-lines">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="pwfb-chart-bars">
                {[42, 55, 48, 68, 61, 78, 73, 88, 82, 94, 86, 100].map(
                  (height, index) => (
                    <div key={index} style={{ height: `${height}%` }}>
                      <i />
                    </div>
                  ),
                )}
              </div>
              <div className="pwfb-chart-labels">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(
                  (month) => <span key={month}>{month}</span>,
                )}
              </div>
            </div>
          </div>

          <div className="pwfb-reference-panel">
            <div className="pwfb-panel-heading">
              <div>
                <small>ACTIVITY</small>
                <h2>Recent Activities</h2>
              </div>
              <Link href="/transactions">View All →</Link>
            </div>

            <div className="pwfb-activity-list">
              <div>
                <b className="activity-green">₦</b>
                <section>
                  <strong>Recent financial activity</strong>
                  <span>Transactions and account movements</span>
                </section>
                <small>{loading ? '—' : money(summary.transactions.amount)}</small>
              </div>

              <div>
                <b className="activity-orange">↗</b>
                <section>
                  <strong>Loan repayments received</strong>
                  <span>Customer repayment activity</span>
                </section>
                <small>{loading ? '—' : money(summary.repayments.amount)}</small>
              </div>

              <div>
                <b className="activity-green">+</b>
                <section>
                  <strong>Customer savings activity</strong>
                  <span>Deposits recorded in the system</span>
                </section>
                <small>{loading ? '—' : money(summary.savings.amount)}</small>
              </div>
            </div>
          </div>
        </div>

        <aside className="pwfb-reference-side">
          <div className="pwfb-reference-panel">
            <div className="pwfb-panel-heading">
              <div>
                <small>LOAN PORTFOLIO</small>
                <h2>Loan Status</h2>
              </div>
            </div>

            <div className="pwfb-loan-status">
              <div className="pwfb-donut">
                <strong>{loading ? '—' : summary.loans.count}</strong>
                <span>Total Loans</span>
              </div>

              <div className="pwfb-status-list">
                <div><i className="status-approved" /><span>Active</span><strong>—</strong></div>
                <div><i className="status-pending" /><span>Pending</span><strong>—</strong></div>
                <div><i className="status-paid" /><span>Paid</span><strong>—</strong></div>
              </div>
            </div>
          </div>

          <div className="pwfb-reference-panel">
            <div className="pwfb-panel-heading">
              <div>
                <small>OPERATIONS</small>
                <h2>Quick Shortcuts</h2>
              </div>
            </div>

            <div className="pwfb-shortcuts">
              <Link href="/customers/add"><b>+</b><span>Add Customer</span></Link>
              <Link href="/savings/add"><b>₦</b><span>New Deposit</span></Link>
              <Link href="/loans/add"><b>▣</b><span>Create Loan</span></Link>
              <Link href="/repayments/add"><b>↗</b><span>Record Repayment</span></Link>
              <Link href="/transactions/add"><b>↔</b><span>New Transaction</span></Link>
              <Link href="/reports"><b>▤</b><span>Reports</span></Link>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
