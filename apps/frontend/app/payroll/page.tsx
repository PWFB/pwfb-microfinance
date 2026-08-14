'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Payroll = {
  id: string;
  status: string;
  totalBasic: number;
  totalAllowances: number;
  totalDeductions: number;
  totalNet: number;
  period?: { name: string };
  branch?: { name: string };
  items?: unknown[];
};

const money = (v: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [rows, totals] = await Promise.all([
        apiRequest('/payroll'),
        apiRequest('/payroll/summary'),
      ]);

      setPayrolls(Array.isArray(rows) ? rows : []);
      setSummary(totals || {});
    } catch (e: any) {
      setError(e.message || 'Unable to load payroll.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function action(id: string, endpoint: string) {
    try {
      await apiRequest(`/payroll/${id}/${endpoint}`, { method: 'PATCH' });
      await load();
    } catch (e: any) {
      setError(e.message || 'Payroll action failed.');
    }
  }

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">HUMAN RESOURCES & FINANCE</p>
          <h1 className="pwfb-page-title">Payroll</h1>
          <p className="pwfb-page-description">
            Manage staff payroll, approvals and payments.
          </p>
        </div>
        <Link href="/dashboard" className="pwfb-secondary-button">
          ← Dashboard
        </Link>
      </div>

      {error && <div className="pwfb-alert">{error}</div>}

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card">
          <span>Payroll Runs</span>
          <strong>{loading ? '—' : summary.payrollCount || 0}</strong>
          <small>Payroll records</small>
        </div>

        <div className="pwfb-stat-card pwfb-stat-orange">
          <span>Total Net Payroll</span>
          <strong>{loading ? '—' : money(summary.totalNet)}</strong>
          <small>Net staff pay</small>
        </div>

        <div className="pwfb-stat-card">
          <span>Deductions</span>
          <strong>{loading ? '—' : money(summary.totalDeductions)}</strong>
          <small>Total deductions</small>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Payroll Register</h2>
            <p>Draft, approved and paid payroll runs.</p>
          </div>
          <span className="pwfb-record-count">{payrolls.length} records</span>
        </div>

        <div className="pwfb-table-wrap">
          <table className="pwfb-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Branch</th>
                <th>Staff</th>
                <th>Net</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {payrolls.map(payroll => (
                <tr key={payroll.id}>
                  <td><strong>{payroll.period?.name || '—'}</strong></td>
                  <td>{payroll.branch?.name || 'All branches'}</td>
                  <td>{payroll.items?.length || 0}</td>
                  <td>{money(payroll.totalNet)}</td>
                  <td>
                    <span className="pwfb-status-badge">
                      {payroll.status}
                    </span>
                  </td>
                  <td>
                    {payroll.status === 'DRAFT' && (
                      <button
                        type="button"
                        className="pwfb-secondary-button"
                        onClick={() => action(payroll.id, 'approve')}
                      >
                        Approve
                      </button>
                    )}

                    {payroll.status === 'APPROVED' && (
                      <button
                        type="button"
                        className="pwfb-secondary-button"
                        onClick={() => action(payroll.id, 'pay')}
                      >
                        Mark Paid
                      </button>
                    )}

                    {payroll.status === 'PAID' && 'Completed'}
                  </td>
                </tr>
              ))}

              {!loading && payrolls.length === 0 && (
                <tr>
                  <td colSpan={6}>No payroll records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
