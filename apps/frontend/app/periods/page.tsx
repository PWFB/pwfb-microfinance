'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Period = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
};

const date = (v: string) =>
  new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(v));

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await apiRequest('/periods');
      setPeriods(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || 'Unable to load financial periods.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function closePeriod(id: string) {
    if (!confirm('Close this financial period?')) return;

    try {
      await apiRequest(`/periods/${id}/close`, { method: 'PATCH' });
      await load();
    } catch (e: any) {
      setError(e.message || 'Unable to close period.');
    }
  }

  const open = periods.filter(p => p.status === 'OPEN').length;

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">FINANCE & ACCOUNTS</p>
          <h1 className="pwfb-page-title">Financial Periods</h1>
          <p className="pwfb-page-description">
            Manage accounting periods used across PWFB operations.
          </p>
        </div>
        <Link href="/dashboard" className="pwfb-secondary-button">
          ← Dashboard
        </Link>
      </div>

      {error && <div className="pwfb-alert">{error}</div>}

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card">
          <span>Total Periods</span>
          <strong>{loading ? '—' : periods.length}</strong>
          <small>Registered periods</small>
        </div>

        <div className="pwfb-stat-card pwfb-stat-orange">
          <span>Open Periods</span>
          <strong>{loading ? '—' : open}</strong>
          <small>Currently active</small>
        </div>

        <div className="pwfb-stat-card">
          <span>Closed Periods</span>
          <strong>{loading ? '—' : periods.length - open}</strong>
          <small>Locked periods</small>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Period Register</h2>
            <p>Financial control periods for PWFB.</p>
          </div>
          <span className="pwfb-record-count">{periods.length} records</span>
        </div>

        <div className="pwfb-table-wrap">
          <table className="pwfb-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {periods.map(period => (
                <tr key={period.id}>
                  <td><strong>{period.name}</strong></td>
                  <td>{date(period.startDate)}</td>
                  <td>{date(period.endDate)}</td>
                  <td>
                    <span className="pwfb-status-badge">
                      {period.status}
                    </span>
                  </td>
                  <td>
                    {period.status === 'OPEN' ? (
                      <button
                        type="button"
                        className="pwfb-secondary-button"
                        onClick={() => closePeriod(period.id)}
                      >
                        Close
                      </button>
                    ) : (
                      'Locked'
                    )}
                  </td>
                </tr>
              ))}

              {!loading && periods.length === 0 && (
                <tr>
                  <td colSpan={5}>No financial periods found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
