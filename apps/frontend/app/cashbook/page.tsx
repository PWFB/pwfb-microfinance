'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Entry = {
  id: string;
  type: string;
  amount: number;
  reference?: string;
  description?: string;
  entryDate: string;
  period?: { name: string };
  branch?: { name: string };
};

const money = (v: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

export default function CashbookPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [rows, totals] = await Promise.all([
        apiRequest('/cashbook'),
        apiRequest('/cashbook/summary'),
      ]);

      setEntries(Array.isArray(rows) ? rows : []);
      setSummary(totals || {});
    } catch (e: any) {
      setError(e.message || 'Unable to load cashbook.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">FINANCE & ACCOUNTS</p>
          <h1 className="pwfb-page-title">Cashbook</h1>
          <p className="pwfb-page-description">
            Monitor cash inflows, outflows and operational cash balance.
          </p>
        </div>
        <Link href="/dashboard" className="pwfb-secondary-button">
          ← Dashboard
        </Link>
      </div>

      {error && <div className="pwfb-alert">{error}</div>}

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card">
          <span>Cash In</span>
          <strong>{loading ? '—' : money(summary.cashIn)}</strong>
          <small>Total inflows</small>
        </div>

        <div className="pwfb-stat-card pwfb-stat-orange">
          <span>Cash Out</span>
          <strong>{loading ? '—' : money(summary.cashOut)}</strong>
          <small>Total outflows</small>
        </div>

        <div className="pwfb-stat-card">
          <span>Cash Balance</span>
          <strong>{loading ? '—' : money(summary.balance)}</strong>
          <small>Net cash position</small>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Cashbook Entries</h2>
            <p>Recent cash movements across PWFB.</p>
          </div>
          <span className="pwfb-record-count">
            {entries.length} records
          </span>
        </div>

        <div className="pwfb-table-wrap">
          <table className="pwfb-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Branch</th>
                <th>Reference</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {entries.map(entry => (
                <tr key={entry.id}>
                  <td>{new Date(entry.entryDate).toLocaleDateString('en-NG')}</td>
                  <td><span className="pwfb-status-badge">{entry.type}</span></td>
                  <td>{entry.branch?.name || '—'}</td>
                  <td>{entry.reference || '—'}</td>
                  <td>{entry.description || '—'}</td>
                  <td><strong>{money(entry.amount)}</strong></td>
                </tr>
              ))}

              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={6}>No cashbook entries found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
