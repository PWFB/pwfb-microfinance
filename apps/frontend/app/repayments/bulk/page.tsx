"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";

type BulkLoan = {
  loanId: string;
  clientId: string;
  customerName: string;
  phone?: string | null;
  amount: number;
  loanType: string;
  repaymentFrequency: string;
  installmentAmount: number;
  dueToDate: number;
  paidToDate: number;
  paidToday: number;
  remainingDue: number;
  status: "PAID" | "UNPAID";
  account?: {
    accountNumber: string;
    accountName?: string | null;
    bankCode?: string;
    bankName?: string;
    verified?: boolean;
  } | null;
  duplicateAccount: boolean;
  duplicateAccountCustomers: Array<{
    clientId: string;
    customerName: string;
    loanId: string;
    accountNumber: string;
    accountName?: string | null;
    bankName?: string;
  }>;
};

type BulkResponse = {
  date: string;
  count: number;
  paidCount: number;
  unpaidCount: number;
  totalDue: number;
  totalPaidToday: number;
  duplicateAccountCount: number;
  duplicateAccounts: Array<{ key: string; accountNumber: string; bankName: string; customers: BulkLoan["duplicateAccountCustomers"] }>;
  loans: BulkLoan[];
};

const API_ERROR = "Unable to load the daily loan repayment list.";
const money = (value: number) => "₦" + Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

export default function BulkDailyRepaymentPage() {
  const { user } = useAuth();
  const role = String(user?.role || "").toUpperCase();
  const allowed = ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "TELLER", "CREDIT_OFFICER"].includes(role);
  const [date, setDate] = useState(today());
  const [data, setData] = useState<BulkResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [batchReference, setBatchReference] = useState("");
  const [notes, setNotes] = useState("");
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    if (!allowed) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await apiRequest("/repayments/bulk/daily?date=" + encodeURIComponent(date)) as BulkResponse;
      const rows = Array.isArray(response?.loans) ? response.loans : [];
      setData({ ...response, loans: rows });
      setSelected({});
      setAmounts(Object.fromEntries(rows.map(row => [row.loanId, String(row.remainingDue || row.installmentAmount || "")])));
    } catch (error) {
      setData(null);
      setMessage(error instanceof Error ? error.message : API_ERROR);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (allowed) void load();
  }, [date, allowed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.loans || [];
    return (data?.loans || []).filter(row =>
      [row.customerName, row.clientId, row.loanId, row.account?.accountNumber, row.account?.accountName, row.account?.bankName]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [data, search]);

  const selectedRows = useMemo(() => (data?.loans || []).filter(row => selected[row.loanId]), [data, selected]);
  const selectedTotal = useMemo(() => Math.round(selectedRows.reduce((sum, row) => sum + Number(amounts[row.loanId] || 0), 0) * 100) / 100, [selectedRows, amounts]);
  const allUnpaidSelected = filtered.filter(row => row.status === "UNPAID").length > 0 &&
    filtered.filter(row => row.status === "UNPAID").every(row => selected[row.loanId]);

  function toggleOne(row: BulkLoan, checked: boolean) {
    setSelected(current => ({ ...current, [row.loanId]: checked }));
    if (checked && !amounts[row.loanId]) {
      setAmounts(current => ({ ...current, [row.loanId]: String(row.remainingDue || row.installmentAmount) }));
    }
  }

  function toggleAll(checked: boolean) {
    setSelected(current => {
      const next = { ...current };
      for (const row of filtered) next[row.loanId] = checked && row.status === "UNPAID";
      return next;
    });
  }

  async function submitBulk() {
    if (!selectedRows.length) return setMessage("Select at least one unpaid daily loan.");
    if (!batchReference.trim()) return setMessage("Enter a unique batch receipt reference.");
    if (!cashConfirmed) return setMessage("Confirm that the full bulk cash amount has physically been received and counted.");
    for (const row of selectedRows) {
      const amount = Number(amounts[row.loanId]);
      if (!Number.isFinite(amount) || amount <= 0) return setMessage("Enter a positive repayment amount for " + row.customerName + ".");
      if (amount > row.remainingDue + 0.005) return setMessage("The amount for " + row.customerName + " exceeds the current amount due. Refresh the daily list before continuing.");
      if (row.status !== "UNPAID") return setMessage("A paid loan cannot be included in the bulk repayment batch.");
    }
    setSubmitting(true);
    setMessage("");
    try {
      const result: any = await apiRequest("/repayments/bulk", {
        method: "POST",
        body: JSON.stringify({
          date,
          batchReference: batchReference.trim(),
          cashReceivedConfirmed: true,
          notes: notes.trim() || undefined,
          items: selectedRows.map(row => ({ loanId: row.loanId, amount: Number(amounts[row.loanId]) })),
        }),
      });
      setMessage("Bulk repayment recorded successfully: " + Number(result.paymentCount || selectedRows.length) +
        " payments, total " + money(Number(result.totalAmount || selectedTotal)) +
        ". Cashbook receipts and loan allocations were posted together.");
      setBatchReference("");
      setNotes("");
      setCashConfirmed(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bulk repayment could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!allowed) {
    return <main className="bulk-page"><section className="bulk-panel"><h1>Bulk Daily Loan Payment</h1><p>This workflow is not assigned to your role.</p><Link href="/banking">Return to Banking</Link></section></main>;
  }

  return (
    <main className="bulk-page">
      <style jsx>{`
        .bulk-page{max-width:1480px;margin:0 auto;padding:12px 0 44px;color:#17382d}
        .bulk-hero{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:24px;border-radius:20px;background:linear-gradient(130deg,#073b2a,#0b5b40);color:#fff}
        .bulk-hero h1{font-size:28px;font-weight:850;margin:0 0 6px}.bulk-hero p{font-size:13px;color:#d4e5dc;margin:0;max-width:760px;line-height:1.5}
        .bulk-actions{display:flex;gap:9px;flex-wrap:wrap}.bulk-link,.bulk-button{border:0;border-radius:10px;padding:11px 14px;text-decoration:none;font-weight:800;font-size:12px;cursor:pointer}
        .bulk-link{background:#fff;color:#14533c}.bulk-button{background:#f7931e;color:#fff}.bulk-button:disabled{opacity:.5;cursor:not-allowed}
        .bulk-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:15px 0}
        .bulk-metric{background:#fff;border:1px solid #e3ebe6;border-radius:14px;padding:15px}.bulk-metric span{display:block;font-size:11px;color:#6c7b73;font-weight:700}.bulk-metric strong{display:block;margin-top:7px;font-size:21px;color:#153e30}
        .bulk-panel{background:#fff;border:1px solid #e4ebe7;border-radius:16px;overflow:hidden;margin-top:14px}
        .bulk-toolbar{display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap;padding:16px;border-bottom:1px solid #e9efeb}
        .bulk-toolbar h2{font-size:17px;margin:0 0 4px}.bulk-toolbar p{font-size:11px;color:#748279;margin:0}
        .bulk-field{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:750;color:#65756c}.bulk-field input{border:1px solid #dce5df;border-radius:9px;padding:9px 10px;background:#fbfdfb;color:#17382d;min-width:150px}
        .bulk-search{min-width:220px!important}.bulk-scroll{overflow:auto}.bulk-table{width:100%;border-collapse:collapse;min-width:1120px}
        .bulk-table th{background:#f5f8f6;color:#64736a;font-size:10px;text-align:left;letter-spacing:.04em;text-transform:uppercase;padding:11px}
        .bulk-table td{border-top:1px solid #edf1ee;padding:11px;font-size:12px;vertical-align:middle}
        .bulk-table small{display:block;color:#78857e;font-size:10px;margin-top:3px}
        .status{display:inline-block;border-radius:99px;padding:6px 9px;font-size:10px;font-weight:900;white-space:nowrap}
        .paid{background:#e8f7ed;color:#08733d}.unpaid{background:#fff0ef;color:#a52e38}
        .duplicate{display:inline-block;background:#fff3db;color:#915600;border-radius:7px;padding:5px 7px;font-size:10px;font-weight:850}
        .bulk-alert{margin:14px;padding:13px;border:1px solid #f0d39b;border-radius:12px;background:#fffaf0;color:#775018;font-size:12px}
        .bulk-submit{padding:16px;border-top:1px solid #e9efeb;display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
        .bulk-confirm{display:flex;gap:9px;align-items:flex-start;font-size:12px;line-height:1.5;color:#30493d}.bulk-confirm input{width:18px;height:18px;margin-top:2px}
        .bulk-message{margin:14px;padding:12px;border-radius:10px;background:#eef6f1;color:#20543b;font-size:12px}
        @media(max-width:900px){.bulk-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.bulk-hero{align-items:flex-start;flex-direction:column}.bulk-submit{grid-template-columns:1fr}}
      `}</style>
      <section className="bulk-hero">
        <div><p style={{fontWeight:850,letterSpacing:".12em",fontSize:10,marginBottom:7}}>LAB MICROFINANCE · TELLER / CREDIT OFFICER</p><h1>Bulk Daily Loan Payment</h1><p>View every eligible daily-repayment loan within your assigned branch or officer scope. Select loans, confirm the cash collected, and post all selected repayments to their existing Client IDs, loans and cashbook in one batch.</p></div>
        <div className="bulk-actions"><Link href="/banking" className="bulk-link">Banking Operations</Link><Link href="/repayments" className="bulk-link">Repayment Register</Link></div>
      </section>

      <section className="bulk-metrics">
        <div className="bulk-metric"><span>Daily Loan Accounts</span><strong>{loading ? "—" : data?.count ?? 0}</strong></div>
        <div className="bulk-metric"><span>Selected Payment No.</span><strong>{selectedRows.length}</strong></div>
        <div className="bulk-metric"><span>Selected Payment Amount</span><strong>{money(selectedTotal)}</strong></div>
        <div className="bulk-metric"><span>Paid 💚</span><strong>{data?.paidCount ?? 0}</strong></div>
        <div className="bulk-metric"><span>Not Paid ♥️</span><strong>{data?.unpaidCount ?? 0}</strong></div>
      </section>

      <section className="bulk-panel">
        <div className="bulk-toolbar">
          <div><h2>Daily Registered Loan List</h2><p>{data ? data.count + " daily repayment loans in your assigned scope for " + date : "Select a date to view daily loans."}</p></div>
          <div style={{display:"flex",gap:9,flexWrap:"wrap",alignItems:"end"}}>
            <label className="bulk-field">Repayment date<input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value)} /></label>
            <label className="bulk-field">Search Client ID / Loan / Account<input className="bulk-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ID, customer or account" /></label>
            <button className="bulk-link" onClick={()=>void load()} disabled={loading}>Refresh</button>
          </div>
        </div>
        {data?.duplicateAccounts?.length ? <div className="bulk-alert">
          <strong>Duplicate registered bank accounts detected: {data.duplicateAccounts.length}</strong>
          {data.duplicateAccounts.map(group=><div key={group.key} style={{marginTop:8}}>
            <strong>{group.bankName} · {group.accountNumber}</strong>
            {group.customers.map(person=><div key={person.loanId}>• {person.customerName} · Client ID {person.clientId} · Loan {person.loanId} · registered name {person.accountName || "not supplied"}</div>)}
          </div>)}
          <small style={{display:"block",marginTop:8}}>This is a shared-account warning for identity checking. This screen records physical cash repayments; it does not send bank transfers or make payouts to these accounts.</small>
        </div> : null}
        {message && <div className="bulk-message" role="status">{message}</div>}
        <div className="bulk-scroll">
          <table className="bulk-table">
            <thead><tr>
              <th><input type="checkbox" checked={allUnpaidSelected} onChange={e=>toggleAll(e.target.checked)} aria-label="Select all unpaid loans" /></th>
              <th>Client / Customer</th><th>Loan ID</th><th>Registered Account</th><th>Installment</th><th>Due to Date</th><th>Paid Today</th><th>Payment Amount</th><th>Daily Status</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} style={{textAlign:"center",padding:30}}>Loading daily registered loans…</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={9} style={{textAlign:"center",padding:30}}>No eligible daily repayment loans found for this date and assigned scope.</td></tr>
              : filtered.map(row=><tr key={row.loanId}>
                <td><input type="checkbox" checked={Boolean(selected[row.loanId])} disabled={row.status==="PAID"} onChange={e=>toggleOne(row,e.target.checked)} /></td>
                <td><strong>{row.customerName}</strong><small>Client ID: {row.clientId}</small><small>{row.phone || "No phone on file"}</small></td>
                <td>{row.loanId}<small>{row.loanType} · {row.repaymentFrequency}</small></td>
                <td>{row.account ? <><strong>{row.account.accountNumber}</strong><small>{row.account.accountName || "Registered account name missing"}</small><small>{row.account.bankName}</small>{row.duplicateAccount&&<span className="duplicate">SHARED ACCOUNT</span>}</> : <span className="unpaid">No registered bank account</span>}</td>
                <td>{money(row.installmentAmount)}</td><td>{money(row.remainingDue)}</td><td>{money(row.paidToday)}</td>
                <td>{row.status==="PAID" ? money(0) : <input aria-label={"Payment amount for "+row.customerName} type="number" min="0" max={row.remainingDue} step="0.01" value={amounts[row.loanId] ?? ""} disabled={!selected[row.loanId]} onChange={e=>setAmounts(current=>({...current,[row.loanId]:e.target.value}))} style={{width:125,border:"1px solid #dce5df",borderRadius:8,padding:7}} />}</td>
                <td><span className={"status "+(row.status==="PAID"?"paid":"unpaid")}>{row.status==="PAID"?"💚 PAID":"♥️ UNPAID"}</span><small>Paid today: {money(row.paidToday)}</small></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="bulk-submit">
          <div>
            <label className="bulk-field">Unique bulk receipt reference<input value={batchReference} onChange={e=>setBatchReference(e.target.value)} placeholder="e.g. LAB-BULK-20261109" maxLength={60}/></label>
            <label className="bulk-field" style={{marginTop:10}}>Optional batch narration<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Daily branch cash repayment batch"/></label>
            <div style={{fontSize:12,marginTop:12,color:"#53655b"}}>Selected: <strong>{selectedRows.length} loans</strong> · Total cash to post: <strong>{money(selectedTotal)}</strong></div>
          </div>
          <div>
            <label className="bulk-confirm"><input type="checkbox" checked={cashConfirmed} onChange={e=>setCashConfirmed(e.target.checked)}/><span><strong>Physical cash received and counted.</strong><br/>I confirm the full selected amount of {money(selectedTotal)} is physically in branch custody. This batch will create one repayment and one linked cashbook receipt per selected loan, attributed to my Staff ID.</span></label>
            <button className="bulk-button" style={{width:"100%",marginTop:12}} disabled={submitting||loading||!selectedRows.length||!cashConfirmed} onClick={()=>void submitBulk()}>{submitting?"Posting bulk repayments…":"Bulk Payment · "+selectedRows.length+" loans"}</button>
            <small style={{display:"block",color:"#6e7c74",fontSize:10,marginTop:8}}>All selected repayments are committed together. If one item fails validation, the entire batch is rolled back. Reference duplicates are rejected.</small>
          </div>
        </div>
      </section>
    </main>
  );
}
