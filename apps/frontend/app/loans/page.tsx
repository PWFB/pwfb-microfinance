"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface BankAccount { accountNumber: string; accountName?: string; isPrimary?: boolean; institution?: { name?: string; code?: string }; }
interface Guarantor { id: string; firstName: string; middleName?: string; lastName: string; }
interface Loan {
  id: string;
  customerId: string;
  amount: number;
  interestRate?: number;
  status?: string;
  disbursementAmount?: number;
  disbursementAccountNumber?: string;
  disbursementAccountName?: string;
  disbursementBankCode?: string;
  disbursementBankName?: string;
  disbursementUsesAlternativeAccount?: boolean;
  guarantors?: Guarantor[];
  customer?: { firstName: string; middleName?: string; lastName: string; bankAccounts?: BankAccount[] };
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
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [alternative, setAlternative] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [disbursementAmount, setDisbursementAmount] = useState("");
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

  function openDisbursement(loan: Loan) {
    setSelectedLoan(loan);
    setAlternative(Boolean(loan.disbursementUsesAlternativeAccount));
    setAccountNumber(loan.disbursementAccountNumber ?? "");
    setAccountName(loan.disbursementAccountName ?? "");
    setBankCode(loan.disbursementBankCode ?? "");
    setBankName(loan.disbursementBankName ?? "");
    setDisbursementAmount(String(loan.disbursementAmount ?? loan.amount));
  }

  async function submitDisbursement() {
    if (!selectedLoan) return;
    setBusyId(selectedLoan.id); setMessage("");
    try {
      const body = alternative ? {
        accountNumber,
        accountName,
        bankCode,
        bankName,
        amount: Number(disbursementAmount),
      } : { amount: Number(disbursementAmount) };
      const res = await fetch(`${API_URL}/loans/${selectedLoan.id}/submit-disbursement`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not submit loan");
      setSelectedLoan(null);
      setMessage("Loan sent to the Branch Manager for confirmation.");
      await loadLoans();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit loan"); }
    finally { setBusyId(""); }
  }

  async function approveDisbursement(id: string) {
    if (!window.confirm("Confirm that this loan is proper and disburse it to the selected beneficiary account?")) return;
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

  async function copyAccounts(loan: Loan) {
    const accounts = (loan.customer?.bankAccounts ?? []).map((a) => `${a.institution?.name ?? "Bank"} | ${a.accountName ?? ""} | ${a.accountNumber} | ${a.institution?.code ?? ""}`).join("\n");
    const alternativeLine = loan.disbursementAccountNumber ? `\nDisbursement account: ${loan.disbursementBankName ?? ""} | ${loan.disbursementAccountName ?? ""} | ${loan.disbursementAccountNumber} | ${loan.disbursementBankCode ?? ""}` : "";
    await navigator.clipboard.writeText(`${accounts || "No registered account"}${alternativeLine}`);
    setMessage("All available customer account details copied.");
  }

  function downloadAccounts(loan: Loan) {
    const rows = [["Type", "Bank", "Bank Code", "Account Name", "Account Number"], ...(loan.customer?.bankAccounts ?? []).map((a) => ["Registered", a.institution?.name ?? "", a.institution?.code ?? "", a.accountName ?? "", a.accountNumber])];
    if (loan.disbursementAccountNumber) rows.push(["Disbursement", loan.disbursementBankName ?? "", loan.disbursementBankCode ?? "", loan.disbursementAccountName ?? "", loan.disbursementAccountNumber]);
    const csv = rows.map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `pwfb-loan-${loan.id}-accounts.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const activeLoans = loans.filter((loan) => (loan.status ?? "Pending").toLowerCase() === "active").length;
  const totalAmount = loans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
  const formatAmount = (amount: number) => `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <main>
      <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">LOAN MANAGEMENT</p><h1 className="pwfb-page-title">Loans</h1><p className="pwfb-page-description">Manage loan applications, guarantors, approvals, beneficiary accounts and disbursement.</p></div><div className="pwfb-actions"><Link href="/loans/guarantor/add" className="pwfb-secondary-button">+ Add Guarantor</Link>{(role === "ADMIN" || role === "SUPER_ADMIN") && <Link href="/loans/add" className="pwfb-primary-button">+ Add Loan</Link>}</div></div>
      {message && <div className="pwfb-panel" style={{ marginBottom: 16 }}><strong>{message}</strong></div>}
      <section className="pwfb-stat-grid"><div className="pwfb-stat-card"><span>Total Loans</span><strong>{loading ? "—" : loans.length}</strong><small>Loan accounts</small></div><div className="pwfb-stat-card pwfb-stat-orange"><span>Total Loan Value</span><strong>{loading ? "—" : formatAmount(totalAmount)}</strong><small>Principal issued</small></div><div className="pwfb-stat-card"><span>Active Loans</span><strong>{loading ? "—" : activeLoans}</strong><small>Currently active</small></div></section>
      <section className="pwfb-panel"><div className="pwfb-panel-header"><div><h2>Loan Directory</h2><p>All roles can view account and loan history. Only Admin and Super Admin can edit loan records.</p></div><span className="pwfb-record-count">{loading ? "Loading..." : `${loans.length} records`}</span></div>
        {loading ? <div className="pwfb-empty-state"><div className="pwfb-loading-dot" /><p>Loading loans...</p></div> : loans.length === 0 ? <div className="pwfb-empty-state"><div className="pwfb-empty-icon">💰</div><h3>No loans found</h3><p>Start by adding your first loan.</p></div> : <div className="pwfb-table-wrap"><table className="pwfb-table"><thead><tr><th>Customer</th><th>Loan</th><th>Beneficiary Account</th><th>Status</th><th>Actions</th></tr></thead><tbody>{loans.map((loan) => { const status = loan.status ?? "Pending"; const waiting = status === "DISBURSEMENT_PENDING_BRANCH_REVIEW"; const account = loan.disbursementAccountNumber ? `${loan.disbursementBankName ?? "Bank"} · ${loan.disbursementAccountNumber}` : loan.customer?.bankAccounts?.[0] ? `${loan.customer.bankAccounts[0].institution?.name ?? "Bank"} · ${loan.customer.bankAccounts[0].accountNumber}` : "No account"; return <tr key={loan.id}><td><div className="pwfb-customer-cell"><div className="pwfb-avatar">₦</div><div><strong>{loan.customer ? `${loan.customer.firstName} ${loan.customer.middleName ? loan.customer.middleName + " " : ""}${loan.customer.lastName}` : "Customer"}</strong><small>{loan.customerId}</small></div></div></td><td><strong>{formatAmount(Number(loan.disbursementAmount ?? loan.amount))}</strong><small>{loan.interestRate != null ? `${loan.interestRate}% interest` : ""}</small></td><td><strong>{account}</strong><small>{loan.disbursementAccountName ?? loan.customer?.bankAccounts?.[0]?.accountName ?? ""}</small></td><td><span className="pwfb-status-badge">{status}</span></td><td><div className="pwfb-actions"><Link href={`/loans/view/${loan.id}`} className="pwfb-action-view">View</Link><button onClick={() => copyAccounts(loan)} className="pwfb-action-edit">Copy accounts</button><button onClick={() => downloadAccounts(loan)} className="pwfb-action-edit">Download</button>{role === "CREDIT_OFFICER" && (status === "PENDING" || status === "APPROVED") && <button disabled={busyId === loan.id} onClick={() => openDisbursement(loan)} className="pwfb-action-edit">Confirm & Send</button>}{(role === "BRANCH_MANAGER" || role === "ADMIN" || role === "SUPER_ADMIN") && waiting && <><button disabled={busyId === loan.id} onClick={() => approveDisbursement(loan.id)} className="pwfb-primary-button">{busyId === loan.id ? "Processing…" : "Check & Disburse"}</button><button disabled={busyId === loan.id} onClick={() => rejectDisbursement(loan.id)} className="pwfb-action-edit">Cancel</button></>}{(role === "ADMIN" || role === "SUPER_ADMIN") && <Link href={`/loans/edit/${loan.id}`} className="pwfb-action-edit">Edit</Link>}</div></td></tr>; })}</tbody></table></div>}
      </section>

      {selectedLoan && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 }}><div className="pwfb-panel" style={{ width: "min(680px, 100%)", maxHeight: "90vh", overflowY: "auto" }}><div className="pwfb-panel-header"><div><h2>Confirm Loan Disbursement</h2><p>Enter an alternative beneficiary only when the Credit Officer has the customer's approved alternative account details.</p></div><button onClick={() => setSelectedLoan(null)} className="pwfb-action-edit">Close</button></div><div className="pwfb-stat-grid"><div className="pwfb-stat-card"><span>Client</span><strong>{selectedLoan.customer ? `${selectedLoan.customer.firstName} ${selectedLoan.customer.lastName}` : selectedLoan.customerId}</strong></div><div className="pwfb-stat-card"><span>Approved Loan</span><strong>{formatAmount(selectedLoan.amount)}</strong></div></div><label style={{ display: "block", marginBottom: 12 }}><input type="checkbox" checked={alternative} onChange={(e) => setAlternative(e.target.checked)} /> Use alternative disbursement account</label>{alternative ? <div style={{ display: "grid", gap: 12 }}><input placeholder="Alternative account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} /><input placeholder="Alternative account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} /><input placeholder="Bank code" value={bankCode} onChange={(e) => setBankCode(e.target.value)} /><input placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} /></div> : <div className="pwfb-panel" style={{ marginBottom: 12 }}><strong>Registered client account</strong><p>{selectedLoan.customer?.bankAccounts?.[0]?.accountName ?? "No account name"} · {selectedLoan.customer?.bankAccounts?.[0]?.accountNumber ?? "No account number"} · {selectedLoan.customer?.bankAccounts?.[0]?.institution?.name ?? "No bank"}</p></div>}<input type="number" min="1" max={selectedLoan.amount} step="0.01" placeholder="Loan amount to disburse" value={disbursementAmount} onChange={(e) => setDisbursementAmount(e.target.value)} style={{ marginTop: 12 }} /><button disabled={busyId === selectedLoan.id} onClick={submitDisbursement} className="pwfb-primary-button" style={{ marginTop: 16 }}>{busyId === selectedLoan.id ? "Sending…" : "Confirm & Send to Branch Manager"}</button></div></div>}
    </main>
  );
}
