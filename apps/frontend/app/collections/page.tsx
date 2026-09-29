'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Collection = {
  id: string;
  type: string;
  amount: number;
  reference?: string;
  notes?: string;
  collectionDate: string;
  reconciled: boolean;
  customer?: { id?: string; firstName: string; lastName: string };
  staff?: { firstName: string; lastName: string };
  branch?: { name: string };
};

type Repayment = { amount: number };
type Loan = {
  id: string;
  customerId: string;
  amount: number;
  interestRate?: number;
  status?: string;
  createdAt?: string;
  customer?: { id: string; firstName: string; lastName: string; phone?: string };
  repayments?: Repayment[];
};

const money = (v: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

function paymentMethod(notes?: string) {
  const value = String(notes || '').toUpperCase();
  if (value.includes('DEPOSIT')) return 'DEPOSIT';
  if (value.includes('CASH')) return 'CASH';
  return '—';
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [rows, totals, loanRows] = await Promise.all([
        apiRequest('/collections'),
        apiRequest('/collections/summary'),
        apiRequest('/loans'),
      ]);

      setCollections(Array.isArray(rows) ? rows : []);
      setSummary(totals || {});
      setLoans(Array.isArray(loanRows) ? loanRows : []);
    } catch (e: any) {
      setError(e.message || 'Unable to load branch office report.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

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

  const unpaidLoans = useMemo(() => loans
    .map((loan) => {
      const principal = Number(loan.amount || 0);
      const paid = (loan.repayments || []).reduce((sum, repayment) => sum + Number(repayment.amount || 0), 0);
      return { ...loan, paid, outstanding: Math.max(0, principal - paid) };
    })
    .filter((loan) => loan.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding), [loans]);

  const unpaidClients = useMemo(() => {
    const seen = new Set<string>();
    return unpaidLoans.filter((loan) => {
      const id = loan.customerId;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [unpaidLoans]);

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">BRANCH OFFICE CONTROL</p>
          <h1 className="pwfb-page-title">Branch Collection Report</h1>
          <p className="pwfb-page-description">
            Review field staff inputs, reconcile payments, edit loans, and follow up remaining unpaid clients.
          </p>
        </div>
        <Link href="/staff-dashboard" className="pwfb-secondary-button">← Staff Dashboard</Link>
      </div>

      {error && <div className="pwfb-alert">{error}</div>}

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card">
          <span>Total Collections</span>
          <strong>{loading ? '—' : money(summary.total)}</strong>
          <small>{summary.collectionCount || 0} collection records</small>
        </div>
        <div className="pwfb-stat-card pwfb-stat-orange">
          <span>Reconciled</span>
          <strong>{loading ? '—' : money(summary.reconciled)}</strong>
          <small>Completed by branch manager</small>
        </div>
        <div className="pwfb-stat-card">
          <span>Pending</span>
          <strong>{loading ? '—' : money(summary.unreconciled)}</strong>
          <small>Awaiting branch review</small>
        </div>
        <div className="pwfb-stat-card pwfb-stat-orange">
          <span>Unpaid Clients</span>
          <strong>{loading ? '—' : unpaidClients.length}</strong>
          <small>Clients with outstanding loan balance</small>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Field Staff → Client Payment Report</h2>
            <p>Staff input is read-only here; the branch manager completes reconciliation.</p>
          </div>
          <span className="pwfb-record-count">{collections.length} records</span>
        </div>

        <div className="pwfb-table-wrap">
          <table className="pwfb-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Client</th>
                <th>Payment type</th>
                <th>Cash / Deposit</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((collection) => (
                <tr key={collection.id}>
                  <td>{collection.staff ? `${collection.staff.firstName} ${collection.staff.lastName}` : '—'}</td>
                  <td>{collection.customer ? `${collection.customer.firstName} ${collection.customer.lastName}` : '—'}</td>
                  <td>{collection.type === 'LOAN_REPAYMENT' ? 'Loan payment' : collection.type === 'SAVINGS' ? 'Savings deposit' : 'Other'}</td>
                  <td><span className="pwfb-status-badge">{paymentMethod(collection.notes)}</span></td>
                  <td><strong>{money(collection.amount)}</strong></td>
                  <td>{new Date(collection.collectionDate).toLocaleDateString('en-NG')}</td>
                  <td><span className="pwfb-status-badge">{collection.reconciled ? 'RECONCILED' : 'PENDING'}</span></td>
                  <td>
                    <button
                      type="button"
                      className="pwfb-secondary-button"
                      onClick={() => reconcile(collection.id, collection.reconciled)}
                    >
                      {collection.reconciled ? 'Unreconcile' : 'Reconcile'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && collections.length === 0 && (
                <tr><td colSpan={8}>No field collections found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Loans Added by Credit Officers</h2>
            <p>Branch manager can review every loan visible to this branch and edit the loan record only.</p>
          </div>
          <span className="pwfb-record-count">{loans.length} loans</span>
        </div>

        <div className="pwfb-table-wrap">
          <table className="pwfb-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Loan amount</th>
                <th>Paid</th>
                <th>Remaining</th>
                <th>Interest</th>
                <th>Status</th>
                <th>Loan action</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => {
                const paid = (loan.repayments || []).reduce((sum, repayment) => sum + Number(repayment.amount || 0), 0);
                const remaining = Math.max(0, Number(loan.amount || 0) - paid);
                return (
                  <tr key={loan.id}>
                    <td>{loan.customer ? `${loan.customer.firstName} ${loan.customer.lastName}` : loan.customerId}</td>
                    <td>{money(loan.amount)}</td>
                    <td>{money(paid)}</td>
                    <td><strong>{money(remaining)}</strong></td>
                    <td>{loan.interestRate != null ? `${loan.interestRate}%` : '—'}</td>
                    <td><span className="pwfb-status-badge">{loan.status || 'PENDING'}</span></td>
                    <td><Link href={`/loans/edit/${loan.id}`} className="pwfb-action-edit">Edit Loan</Link></td>
                  </tr>
                );
              })}
              {!loading && loans.length === 0 && (
                <tr><td colSpan={7}>No branch loans found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Remaining Unpaid Clients</h2>
            <p>Clients with a positive outstanding loan balance, for branch follow-up.</p>
          </div>
          <span className="pwfb-record-count">{unpaidClients.length} clients</span>
        </div>

        <div className="pwfb-table-wrap">
          <table className="pwfb-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Phone</th>
                <th>Loan status</th>
                <th>Outstanding</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {unpaidClients.map((loan) => (
                <tr key={loan.customerId}>
                  <td>{loan.customer ? `${loan.customer.firstName} ${loan.customer.lastName}` : loan.customerId}</td>
                  <td>{loan.customer?.phone || '—'}</td>
                  <td><span className="pwfb-status-badge">{loan.status || 'PENDING'}</span></td>
                  <td><strong>{money(loan.outstanding)}</strong></td>
                  <td><Link href={`/customers/view/${loan.customerId}`} className="pwfb-action-view">View Client</Link></td>
                </tr>
              ))}
              {!loading && unpaidClients.length === 0 && (
                <tr><td colSpan={5}>No unpaid loan clients found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
