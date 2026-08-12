'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Repayment {
  id: string;
  loanId: string;
  amount: number;
  paymentDate: string;
  method?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default function RepaymentsPage() {
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/repayments`)
      .then((res) => res.json())
      .then((data) => {
        setRepayments(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const totalCollected = repayments.reduce(
    (sum, repayment) => sum + Number(repayment.amount || 0),
    0,
  );

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">LOAN SERVICING</p>
          <h1 className="pwfb-page-title">Repayments</h1>
          <p className="pwfb-page-description">
            Record and monitor customer loan repayments and payment activity.
          </p>
        </div>

        <Link href="/repayments/add" className="pwfb-primary-button">
          + Record Repayment
        </Link>
      </div>

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card">
          <span>Total Repayments</span>
          <strong>{loading ? '—' : repayments.length}</strong>
          <small>Payment records</small>
        </div>

        <div className="pwfb-stat-card pwfb-stat-orange">
          <span>Total Collected</span>
          <strong>
            {loading
              ? '—'
              : `₦${totalCollected.toLocaleString('en-NG')}`}
          </strong>
          <small>Recorded repayment value</small>
        </div>

        <div className="pwfb-stat-card">
          <span>Payment Status</span>
          <strong>Active</strong>
          <small>Repayment operations</small>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Repayment Records</h2>
            <p>Recent repayment transactions recorded in the system.</p>
          </div>

          <span className="pwfb-record-count">
            {loading ? 'Loading...' : `${repayments.length} records`}
          </span>
        </div>

        {loading ? (
          <div className="pwfb-empty-state">
            <div className="pwfb-loading-dot" />
            <p>Loading repayments...</p>
          </div>
        ) : repayments.length === 0 ? (
          <div className="pwfb-empty-state">
            <div className="pwfb-empty-icon">₦</div>
            <h3>No repayments found</h3>
            <p>Start by recording the first customer repayment.</p>
            <Link
              href="/repayments/add"
              className="pwfb-secondary-button"
            >
              Record Repayment
            </Link>
          </div>
        ) : (
          <div className="pwfb-table-wrap">
            <table className="pwfb-table">
              <thead>
                <tr>
                  <th>Loan</th>
                  <th>Amount</th>
                  <th>Payment Date</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {repayments.map((repayment) => (
                  <tr key={repayment.id}>
                    <td>
                      <div className="pwfb-customer-cell">
                        <div className="pwfb-avatar">₦</div>
                        <div>
                          <strong>Loan</strong>
                          <small>{repayment.loanId}</small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <strong>
                        ₦{Number(repayment.amount || 0).toLocaleString('en-NG')}
                      </strong>
                    </td>

                    <td>
                      {new Date(repayment.paymentDate).toLocaleDateString(
                        'en-NG',
                        {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        },
                      )}
                    </td>

                    <td>{repayment.method || '—'}</td>

                    <td>
                      <span className="pwfb-status-badge">Completed</span>
                    </td>

                    <td>
                      <div className="pwfb-actions">
                        <Link
                          href={`/repayments/view/${repayment.id}`}
                          className="pwfb-action-view"
                        >
                          View
                        </Link>

                        <Link
                          href={`/repayments/edit/${repayment.id}`}
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
