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
  customer?: { firstName: string; middleName?: string; lastName: string; };
}
const API_URL = process.env.NEXT_PUBLIC_API_URL!;

function currentRole() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return "";
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return String(payload.role || "");
  } catch { return ""; }
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const role = typeof window !== "undefined" ? currentRole() : "";

  async function loadLoans() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/loans`, { headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` } });
      const data = await res.json();
      setLoans(Array.isArray(data) ? data : []);
    } catch { setLoans([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadLoans(); }, []);

  async function submitDisbursement(id: string) {
    setBusyId(id); setMessage("");
    try {
      const res = await fetch(`${API_URL}/loans/${id}/submit-disbursement`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not submit loan");
      setMessage("Loan sent to the Branch Manager for confirmation.");
      await loadLoans();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit loan"); }
    finally { setBusyId(""); }
  }

  async function approveDisbursement(id: string) {
    if (!window.confirm("Confirm that this loan is proper and disburse it to the customer's verified bank account?")) return;
    setBusyId(id); setMessage("");
    try {
      const res = await fetch(`${API_URL}/loans/${id}/approve-disbursement`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Disbursement failed");
      setMessage(data.status === "DISBURSED" ? "Loan disbursed successfully." : "Loan approved and sent to the payment provider for processing.");
      await loadLoans();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Disbursement failed"); }
    finally { setBusyId(""); }
  }

  async function rejectDisbursement(id: string) {
    const reason = window.prompt("Reason for cancelling/rejecting this loan disbursement:", "Loan documentation or approval requirements not satisfied");
    if (reason === null) return;
    setBusyId(id); setMessage("");
    try {
      const res = await fetch(`${API_URL}/loans/${id}/reject-disbursement`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` }, body: JSON.stringify({ reason }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not reject loan");
      setMessage("Loan disbursement cancelled/rejected.");
      await loadLoans();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not reject loan"); }
    finally { setBusyId(""); }
  }

  const activeLoans = loans.filter((loan) => (loan.status ?? "Pending").toLowerCase() === "active").length;
  const totalAmount = loans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
  const formatAmount = (amount: number) => `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <main>
      <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">LOAN MANAGEMENT</p><h1 className="pwfb-page-title">Loans</h1><p className="pwfb-page-description">Manage loan applications, guarantors, balances, interest, approvals and disbursement.</p></div><div className="pwfb-actions"><Link href="/loans/guarantor/add" className="pwfb-secondary-button">+ Add Guarantor</Link><Link href="/loans/add" className="pwfb-primary-button">+ Add Loan</Link></div></div>
      {message && <div className="pwfb-panel" style={{ marginBottom: 16 }}><strong>{message}</strong></div>}
      <section className="pwfb-stat-grid"><div className="pwfb-stat-card"><span>Total Loans</span><strong>{loading ? "—" : loans.length}</strong><small>Loan accounts</small></div><div className="pwfb-stat-card pwfb-stat-orange"><span>Total Loan Value</span><strong>{loading ? "—" : formatAmount(totalAmount)}</strong><small>Principal issued</small></div><div className="pwfb-stat-card"><span>Active Loans</span><strong>{loading ? "—" : activeLoans}</strong><small>Currently active</small></div></section>
      <section className="pwfb-panel"><div className="pwfb-panel-header"><div><h2>Loan Directory</h2><p>Credit Officers submit completed loans here. Branch Managers review their branch loans before disbursement.</p></div><span className="pwfb-record-count">{loading ? "Loading..." : `${loans.length} records`}</span></div>
        {loading ? <div className="pwfb-empty-state"><div className="pwfb-loading-dot" /><p>Loading loans...</p></div> : loans.length === 0 ? <div className="pwfb-empty-state"><div className="pwfb-empty-icon">💰</div><h3>No loans found</h3><p>Start by adding your first loan.</p><Link href="/loans/add" className="pwfb-secondary-button">Add Loan</Link></div> : <div className="pwfb-table-wrap"><table className="pwfb-table"><thead><tr><th>Customer</th><th>Amount</th><th>Interest</th><th>Guarantors</th><th>Status</th><th>Actions</th></tr></thead><tbody>{loans.map((loan) => { const status = loan.status ?? "Pending"; const waiting = status === "DISBURSEMENT_PENDING_BRANCH_REVIEW"; return <tr key={loan.id}><td><div className="pwfb-customer-cell"><div className="pwfb-avatar">₦</div><div><strong>{loan.customer ? `${loan.customer.firstName} ${loan.customer.middleName ? loan.customer.middleName + " " : ""}${loan.customer.lastName}` : "Customer"}</strong><small>Customer ID: {loan.customerId}</small></div></div></td><td>{formatAmount(Number(loan.amount || 0))}</td><td>{loan.interestRate != null ? `${loan.interestRate}%` : "—"}</td><td><span className="pwfb-status-badge">{loan.guarantors?.length ?? 0}</span></td><td><span className="pwfb-status-badge">{status}</span></td><td><div className="pwfb-actions"><Link href={`/loans/guarantor/add?loanId=${loan.id}`} className="pwfb-action-edit">Guarantor</Link><Link href={`/loans/view/${loan.id}`} className="pwfb-action-view">View</Link>{role === "CREDIT_OFFICER" && (status === "PENDING" || status === "APPROVED") && <button disabled={busyId === loan.id} onClick={() => submitDisbursement(loan.id)} className="pwfb-action-edit">{busyId === loan.id ? "Sending…" : "Confirm & Send"}</button>}{(role === "BRANCH_MANAGER" || role === "ADMIN" || role === "SUPER_ADMIN") && waiting && <><button disabled={busyId === loan.id} onClick={() => approveDisbursement(loan.id)} className="pwfb-primary-button">{busyId === loan.id ? "Processing…" : "Check & Disburse"}</button><button disabled={busyId === loan.id} onClick={() => rejectDisbursement(loan.id)} className="pwfb-action-edit">Cancel</button></>}{(role === "ADMIN" || role === "SUPER_ADMIN") && <Link href={`/loans/edit/${loan.id}`} className="pwfb-action-edit">Edit</Link>}</div></td></tr>; })}</tbody></table></div>}
      </section>
    </main>
  );
}
