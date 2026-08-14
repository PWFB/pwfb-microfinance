'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Collection = {
  id: string;
  type: string;
  amount: number;
  reference?: string;
  collectionDate: string;
  reconciled: boolean;
  customer?: { firstName: string; lastName: string };
  staff?: { firstName: string; lastName: string };
  branch?: { name: string };
};

const money = (v: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [rows, totals] = await Promise.all([
        apiRequest('/collections'),
        apiRequest('/collections/summary'),
      ]);

      setCollections(Array.isArray(rows) ? rows : []);
      setSummary(totals || {});
    } catch (e: any) {
      setError(e.message || 'Unable to load collections.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function reconcile(id: string, reconciled: boolean) {
    try {
      await apiRequest(
        `/collections/${id}/${reconciled ? 'unreconcile' : 'reconcile'}`,
        { method: 'PATCH' },
      );
      await load();
    } catch (e: any) {
      setError(e.message || 'Unable to update reconciliation.');
    }
  }

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">FIELD OPERATIONS</p>
          <h1 className="pwfb-page-title">Collections</h1>
          <p className="pwfb-page-description">
            Monitor daily savings and loan repayment collections.
          </p>
        </div>
        <Link href="/dashboard" className="pwfb-secondary-button">
          ← Dashboard
        </Link>
      </div>

      {error && <div className="pwfb-alert">{error}</div>}

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card">
          <span>Total Collections</span>
          <strong>{loading ? '—' : money(summary.total)}</strong>
          <small>{summary.collectionCount || 0} collection records</small>
        </div>

        <div className="pwfb-stat-card pwfb-stat-orange">
          <span>Savings</span>
          <strong>{loading ? '—' : money(summary.savings)}</strong>
          <small>Savings collections</small>
        </div>

        <div className="pwfb-stat-card">
          <span>Loan Repayments</span>
          <strong>{loading ? '—' : money(summary.loanRepayments)}</strong>
          <small>Loan repayment collections</small>
        </div>

        <div className="pwfb-stat-card">
          <span>Unreconciled</span>
          <strong>{loading ? '—' : money(summary.unreconciled)}</strong>
          <small>Awaiting reconciliation</small>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Collection Register</h2>
            <p>Daily field collection activity.</p>
          </div>
          <span className="pwfb-record-count">
            {collections.length} records
          </span>
        </div>

        <div className="pwfb-table-wrap">
          <table className="pwfb-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Collector</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {collections.map(collection => (
                <tr key={collection.id}>
                  <td>{new Date(collection.collectionDate).toLocaleDateString('en-NG')}</td>
                  <td>
                    {collection.customer
                      ? `${collection.customer.firstName} ${collection.customer.lastName}`
                      : '—'}
                  </td>
                  <td>
                    {collection.staff
                      ? `${collection.staff.firstName} ${collection.staff.lastName}`
                      : '—'}
                  </td>
                  <td>{collection.type}</td>
                  <td><strong>{money(collection.amount)}</strong></td>
                  <td>
                    <span className="pwfb-status-badge">
                      {collection.reconciled ? 'RECONCILED' : 'PENDING'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="pwfb-secondary-button"
                      onClick={() =>
                        reconcile(collection.id, collection.reconciled)
                      }
                    >
                      {collection.reconciled ? 'Unreconcile' : 'Reconcile'}
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && collections.length === 0 && (
                <tr>
                  <td colSpan={7}>No collections found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
