"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Guarantor { id: string; firstName: string; middleName?: string; lastName: string; }
interface Loan {
  id: string;
  customerId: string;
  amount: number;
  interestRate?: number;
  status?: string;
  guarantors?: Guarantor[];
}
const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API_URL}/loans`, { headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` } })
      .then((res) => res.json()).then((data) => { setLoans(Array.isArray(data) ? data : []); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  const activeLoans = loans.filter((loan) => (loan.status ?? "Pending").toLowerCase() === "active").length;
  const totalAmount = loans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
  const formatAmount = (amount: number) => `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <main>
      <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">LOAN MANAGEMENT</p><h1 className="pwfb-page-title">Loans</h1><p className="pwfb-page-description">Manage loan applications, guarantors, balances, interest and repayment status.</p></div><div className="pwfb-actions"><Link href="/loans/guarantor/add" className="pwfb-secondary-button">+ Add Guarantor</Link><Link href="/loans/add" className="pwfb-primary-button">+ Add Loan</Link></div></div>
      <section className="pwfb-stat-grid"><div className="pwfb-stat-card"><span>Total Loans</span><strong>{loading ? "—" : loans.length}</strong><small>Loan accounts</small></div><div className="pwfb-stat-card pwfb-stat-orange"><span>Total Loan Value</span><strong>{loading ? "—" : formatAmount(totalAmount)}</strong><small>Principal issued</small></div><div className="pwfb-stat-card"><span>Active Loans</span><strong>{loading ? "—" : activeLoans}</strong><small>Currently active</small></div></section>
      <section className="pwfb-panel"><div className="pwfb-panel-header"><div><h2>Loan Directory</h2><p>All loans currently available in the system.</p></div><span className="pwfb-record-count">{loading ? "Loading..." : `${loans.length} records`}</span></div>
        {loading ? <div className="pwfb-empty-state"><div className="pwfb-loading-dot" /><p>Loading loans...</p></div> : loans.length === 0 ? <div className="pwfb-empty-state"><div className="pwfb-empty-icon">💰</div><h3>No loans found</h3><p>Start by adding your first loan.</p><Link href="/loans/add" className="pwfb-secondary-button">Add Loan</Link></div> : <div className="pwfb-table-wrap"><table className="pwfb-table"><thead><tr><th>Customer</th><th>Amount</th><th>Interest</th><th>Guarantors</th><th>Status</th><th>Actions</th></tr></thead><tbody>{loans.map((loan) => { const status = loan.status ?? "Pending"; return <tr key={loan.id}><td><div className="pwfb-customer-cell"><div className="pwfb-avatar">₦</div><div><strong>Customer</strong><small>Customer ID: {loan.customerId}</small></div></div></td><td>{formatAmount(Number(loan.amount || 0))}</td><td>{loan.interestRate != null ? `${loan.interestRate}%` : "—"}</td><td><span className="pwfb-status-badge">{loan.guarantors?.length ?? 0}</span></td><td><span className="pwfb-status-badge">{status}</span></td><td><div className="pwfb-actions"><Link href={`/loans/guarantor/add?loanId=${loan.id}`} className="pwfb-action-edit">Guarantor</Link><Link href={`/loans/view/${loan.id}`} className="pwfb-action-view">View</Link><Link href={`/loans/edit/${loan.id}`} className="pwfb-action-edit">Edit</Link></div></td></tr>; })}</tbody></table></div>}
      </section>
    </main>
  );
}
