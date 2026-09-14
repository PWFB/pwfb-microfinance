"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { pwfbApi } from "../../lib/pwfb-api";

const money = (value: unknown) => `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function ReportsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [operations, setOperations] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  async function load(nextPage = page) {
    try {
      setError(""); setLoading(true);
      const [s, o] = await Promise.all([
        pwfbApi.reports.summary(),
        pwfbApi.reports.operations({ section, search: search || undefined, from: from || undefined, to: to || undefined, page: nextPage, pageSize }),
      ]);
      setSummary(s); setOperations(o);
    } catch (e: any) { setError(e?.message || "Unable to load reports."); }
    finally { setLoading(false); }
  }

  useEffect(() => { setPage(1); load(1); }, [section]);

  const totalActivity = useMemo(() => Number(summary?.transactions?.count || 0) + Number(summary?.repayments?.count || 0), [summary]);
  const rows = useMemo(() => Object.entries(operations || {}).filter(([key, value]) => Array.isArray(value) && key !== "pagination").flatMap(([kind, value]: any) => value.map((row: any) => ({ ...row, kind }))), [operations]);
  const pagination = operations?.pagination;

  function applyFilters() { setPage(1); load(1); }
  function setQuickDate(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setFrom(start.toISOString().slice(0, 10));
    setTo(today());
    setTimeout(() => load(1), 0);
    setPage(1);
  }

  return (
    <main className="pwfb-reports-page" style={{maxWidth:1180,margin:"0 auto",padding:"28px 24px 60px",color:"#17251e"}}>
      <style>{`.reports-hero{border-radius:24px;padding:30px;background:linear-gradient(135deg,#063d2b,#0d6947);color:#fff;box-shadow:0 18px 45px rgba(6,61,43,.16)}.reports-hero .eyebrow{font-size:12px;font-weight:800;letter-spacing:.14em;opacity:.75}.reports-hero h1{font-size:34px;margin:8px 0}.reports-hero p{max-width:760px;line-height:1.6;opacity:.88}.report-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:22px 0}.report-stat{background:#fff;border:1px solid #e3ebe7;border-radius:18px;padding:18px;box-shadow:0 7px 25px rgba(20,50,38,.05)}.report-stat span{display:block;color:#748079;font-size:12px}.report-stat strong{display:block;font-size:22px;margin:8px 0 3px}.report-stat small{color:#8b968f}.report-panel{background:#fff;border:1px solid #e3ebe7;border-radius:20px;overflow:hidden;margin-top:20px}.report-head{padding:20px 22px;border-bottom:1px solid #e9efec;display:flex;justify-content:space-between;align-items:center;gap:15px}.report-head h2{margin:0;font-size:19px}.report-head p{margin:5px 0 0;color:#718078;font-size:13px}.report-tools{display:grid;grid-template-columns:1.7fr 1fr 1fr 1fr auto;gap:9px;padding:16px 20px;border-bottom:1px solid #edf1ef}.report-tools input,.report-tools select{border:1px solid #dce5e0;border-radius:10px;padding:10px 12px;background:#fff;outline:none;min-width:0}.report-tools input{width:100%}.report-actions{display:flex;gap:7px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid #edf1ef}.report-btn{border:1px solid #dce5e0;border-radius:9px;padding:8px 11px;background:#fff;cursor:pointer;font-weight:700;font-size:12px}.report-btn.primary{border:0;background:#f28c28;color:#fff}.report-table{width:100%;border-collapse:collapse}.report-table th,.report-table td{padding:13px 16px;border-bottom:1px solid #edf1ef;text-align:left;font-size:13px}.report-table th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#718078;background:#f8faf9}.kind{font-weight:800;text-transform:capitalize}.status{font-weight:700}.report-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 20px;background:#fafcfb}.report-link-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:20px}.report-link{display:block;padding:17px;border:1px solid #e1e9e5;border-radius:15px;text-decoration:none;color:inherit}.report-link:hover{border-color:#f28c28;transform:translateY(-1px)}.report-link b{display:block;margin-bottom:5px}.report-link span{font-size:12px;color:#75817a}.report-error{margin-top:15px;padding:12px;border-radius:12px;background:#fff1f1;color:#a13a3a}@media(max-width:950px){.report-grid{grid-template-columns:repeat(2,1fr)}.report-tools{grid-template-columns:1fr 1fr}.report-link-grid{grid-template-columns:1fr 1fr}}@media(max-width:600px){main.pwfb-reports-page{padding:18px 12px}.reports-hero h1{font-size:28px}.report-grid,.report-link-grid,.report-tools{grid-template-columns:1fr}.report-table{min-width:720px}.report-panel{overflow-x:auto}.report-pagination{min-width:720px}}`}</style>
      <section className="reports-hero"><div className="eyebrow">PWFB · MANAGEMENT REPORTING</div><h1>Reports &amp; Analytics</h1><p>Live operational reporting across customers, savings, loans, repayments, collections, staff wallets, cashbook activity and banking transactions. Use the filters to review a controlled reporting period.</p></section>

      <section className="report-grid">
        <div className="report-stat"><span>Customers</span><strong>{loading ? "—" : Number(summary?.customers?.count || 0).toLocaleString()}</strong><small>Registered customers</small></div>
        <div className="report-stat"><span>Total Savings</span><strong>{loading ? "—" : money(summary?.savings?.amount)}</strong><small>{Number(summary?.savings?.count || 0).toLocaleString()} accounts</small></div>
        <div className="report-stat"><span>Loan Portfolio</span><strong>{loading ? "—" : money(summary?.loans?.amount)}</strong><small>{Number(summary?.loans?.count || 0).toLocaleString()} loans</small></div>
        <div className="report-stat"><span>Collections</span><strong>{loading ? "—" : money(summary?.collections?.amount)}</strong><small>{Number(summary?.collections?.count || 0).toLocaleString()} field records</small></div>
        <div className="report-stat"><span>Repayments</span><strong>{loading ? "—" : money(summary?.repayments?.amount)}</strong><small>{Number(summary?.repayments?.count || 0).toLocaleString()} repayments</small></div>
        <div className="report-stat"><span>Cash In</span><strong>{loading ? "—" : money(summary?.cashbook?.cashIn)}</strong><small>Cashbook receipts</small></div>
        <div className="report-stat"><span>Cash Out</span><strong>{loading ? "—" : money(summary?.cashbook?.cashOut)}</strong><small>Cashbook payments</small></div>
        <div className="report-stat"><span>Activity</span><strong>{loading ? "—" : totalActivity.toLocaleString()}</strong><small>Transactions + repayments</small></div>
      </section>

      <section className="report-panel">
        <div className="report-head"><div><h2>Operations Report</h2><p>Search live records and narrow the report by operation and date.</p></div><strong>{pagination?.total ?? 0} records</strong></div>
        <div className="report-tools">
          <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')applyFilters()}} placeholder="Search customer, staff, reference, phone or branch…"/>
          <select value={section} onChange={e=>setSection(e.target.value)}><option value="all">All operations</option><option value="customers">Customers</option><option value="staff">Staff</option><option value="loans">Loans</option><option value="savings">Savings</option><option value="deposits">Wallet deposits</option><option value="withdrawals">Wallet withdrawals</option><option value="transfers">Wallet transfers</option><option value="collections">Field collections</option><option value="cashIn">Cashbook cash in</option><option value="cashOut">Cashbook cash out</option></select>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} aria-label="From date"/>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} aria-label="To date"/>
          <button className="report-btn primary" onClick={applyFilters}>Apply</button>
        </div>
        <div className="report-actions"><button className="report-btn" onClick={()=>{setFrom("");setTo("");setSearch("");setSection("all");setPage(1);setTimeout(()=>load(1),0)}}>Clear filters</button><button className="report-btn" onClick={()=>setQuickDate(0)}>Today</button><button className="report-btn" onClick={()=>setQuickDate(6)}>Last 7 days</button><button className="report-btn" onClick={()=>setQuickDate(29)}>Last 30 days</button><button className="report-btn" onClick={()=>load(page)}>Refresh</button></div>
        {loading ? <div style={{padding:28}}>Loading live report data…</div> : rows.length === 0 ? <div style={{padding:28}}>No operational records found for the current filter.</div> : <div style={{overflowX:"auto"}}><table className="report-table"><thead><tr><th>Area</th><th>Record</th><th>Customer / Staff</th><th>Status / Type</th><th>Amount</th><th>Date</th></tr></thead><tbody>{rows.map((row:any,i:number)=>{const person=[row.customer?.firstName,row.customer?.middleName,row.customer?.lastName].filter(Boolean).join(" ") || [row.staff?.firstName,row.staff?.lastName].filter(Boolean).join(" ") || row.branch?.name || "—";const status=row.status || row.type || (row.reconciled ? "Reconciled" : row.settled ? "Settled" : "—");const date=row.createdAt || row.collectionDate || row.entryDate;return <tr key={`${row.kind}-${row.id || i}`}><td className="kind">{String(row.kind).replace(/([A-Z])/g," $1")}</td><td>{row.reference || row.id || row.customer?.firstName || row.description || "Record"}</td><td>{person}</td><td className="status">{status}</td><td>{row.amount !== undefined ? money(row.amount) : "—"}</td><td>{date ? new Date(date).toLocaleDateString("en-NG") : "—"}</td></tr>})}</tbody></table></div>}
        {!loading && pagination && pagination.total > 0 && <div className="report-pagination"><span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} total records</span><div style={{display:"flex",gap:8}}><button className="report-btn" disabled={page<=1} onClick={()=>{const p=page-1;setPage(p);load(p)}}>← Previous</button><button className="report-btn" disabled={page>=pagination.totalPages} onClick={()=>{const p=page+1;setPage(p);load(p)}}>Next →</button></div></div>}
      </section>

      <section className="report-panel"><div className="report-head"><div><h2>Report Shortcuts</h2><p>Jump directly into each operational reporting area.</p></div></div><div className="report-link-grid">{[{t:"Portfolio Report",d:"Savings, loans and overall portfolio.",h:"/dashboard"},{t:"Customer Report",d:"Customer registration and account activity.",h:"/customers"},{t:"Staff & Wallet Report",d:"Staff assignments and field cash activity.",h:"/staff-daily-wallet"},{t:"Loan Report",d:"Loan balances, disbursements and status.",h:"/loans"},{t:"Repayment Report",d:"Repayments and collection activity.",h:"/repayments"},{t:"Savings Report",d:"Savings accounts and deposits.",h:"/savings"},{t:"Collections Report",d:"Daily field collections and settlement.",h:"/collections"},{t:"Cashbook Report",d:"Branch cash in, cash out and history.",h:"/cashbook"},{t:"Transaction Report",d:"Customer transaction activity and values.",h:"/transactions"}].map(x=><Link className="report-link" href={x.h} key={x.t}><b>{x.t} →</b><span>{x.d}</span></Link>)}</div></section>
      {error && <div className="report-error">{error}</div>}
    </main>
  );
}
