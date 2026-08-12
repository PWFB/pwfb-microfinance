'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Transaction {
  id: string;
  customerId: string;
  type: string;
  amount: number;
  description?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/transactions`)
      .then((res) => res.json())
      .then((data) => {
        setTransactions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const totalValue = transactions.reduce(
    (sum, transaction) => sum + Number(transaction.amount || 0),
    0,
  );

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">FINANCIAL OPERATIONS</p>
          <h1 className="pwfb-page-title">Transactions</h1>
          <p className="pwfb-page-description">
            Monitor customer financial activity and transaction records.
          </p>
        </div>

        <Link href="/transactions/add" className="pwfb-primary-button">
          + Add Transaction
        </Link>
      </div>

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card">
          <span>Total Transactions</span>
          <strong>{loading ? '—' : transactions.length}</strong>
          <small>Recorded activities</small>
        </div>

        <div className="pwfb-stat-card pwfb-stat-orange">
          <span>Total Value</span>
          <strong>
            {loading
              ? '—'
              : `₦${totalValue.toLocaleString('en-NG')}`}
          </strong>
          <small>Transaction value</small>
        </div>

        <div className="pwfb-stat-card">
          <span>System Status</span>
          <strong>Active</strong>
          <small>Financial operations</small>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Transaction Ledger</h2>
            <p>Customer transactions currently available in the system.</p>
          </div>

          <span className="pwfb-record-count">
            {loading ? 'Loading...' : `${transactions.length} records`}
          </span>
        </div>

        {loading ? (
          <div className="pwfb-empty-state">
            <div className="pwfb-loading-dot" />
            <p>Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="pwfb-empty-state">
            <div className="pwfb-empty-icon">₦</div>
            <h3>No transactions found</h3>
            <p>Start by recording your first financial transaction.</p>
            <Link
              href="/transactions/add"
              className="pwfb-secondary-button"
            >
              Add Transaction
            </Link>
          </div>
        ) : (
          <div className="pwfb-table-wrap">
            <table className="pwfb-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <div className="pwfb-customer-cell">
                        <div className="pwfb-avatar">₦</div>
                        <div>
                          <strong>Customer</strong>
                          <small>{transaction.customerId}</small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="pwfb-type-badge">
                        {transaction.type}
                      </span>
                    </td>

                    <td>
                      <strong>
                        ₦{Number(transaction.amount || 0).toLocaleString(
                          'en-NG',
                        )}
                      </strong>
                    </td>

                    <td>{transaction.description || '—'}</td>

                    <td>
                      <span className="pwfb-status-badge">Completed</span>
                    </td>

                    <td>
                      <div className="pwfb-actions">
                        <Link
                          href={`/transactions/view/${transaction.id}`}
                          className="pwfb-action-view"
                        >
                          View
                        </Link>

                        <Link
                          href={`/transactions/edit/${transaction.id}`}
                          className="pwfb-action-edit"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
