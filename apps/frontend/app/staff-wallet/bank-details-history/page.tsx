'use client';

import { useMemo, useState } from 'react';

const rows = [
  { serial: 1, date: '2026-08-27', branch: 'HEADOFFICE', area: '—', division: '—', region: '—', bankCode: '—', bankName: '—', accountNo: '—', accountName: '—', amount: '₦0.00', narration: 'No records yet', reference: '—' },
];

export default function BankDetailsHistoryPage() {
  const [rm, setRm] = useState('');
  const [dm, setDm] = useState('');
  const [am, setAm] = useState('');
  const [bm, setBm] = useState('');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => rows.filter(row => {
    const text = Object.values(row).join(' ').toLowerCase();
    return !search || text.includes(search.toLowerCase());
  }), [search]);

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand"><img src="/pwfb-logo.svg" alt="PWFB" /><div><small>PWFB STAFF WALLET</small><h1>Bank details history</h1></div></div>
        <button className="back" onClick={() => window.location.href = '/staff-wallet'}>← Staff Wallet</button>
      </header>

      <section className="panel">
        <div className="filters">
          <label>RM<select value={rm} onChange={e => setRm(e.target.value)}><option value="">Select RM</option></select></label>
          <label>Select DM<select value={dm} onChange={e => setDm(e.target.value)}><option value="">Select DM</option></select></label>
          <label>Select AM<select value={am} onChange={e => setAm(e.target.value)}><option value="">Select AM</option></select></label>
          <label>Select BM<select value={bm} onChange={e => setBm(e.target.value)}><option value="">Select BM</option></select></label>
          <label>Select date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        </div>
        <div className="search"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search account, branch, bank, reference..." /><button onClick={() => setSearch('')}>Clear</button></div>
      </section>

      <section className="table-panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Serial_no</th><th>Date</th><th>Branch</th><th>Area</th><th>Division</th><th>Region</th><th>Bank Code</th><th>Bank Name</th><th>Account no</th><th>Account name</th><th>Amount</th><th>Narration</th><th>Reference no</th><th>Action</th></tr></thead>
            <tbody>{filtered.map(row => <tr key={row.serial}><td>{row.serial}</td><td>{row.date}</td><td>{row.branch}</td><td>{row.area}</td><td>{row.division}</td><td>{row.region}</td><td>{row.bankCode}</td><td>{row.bankName}</td><td>{row.accountNo}</td><td>{row.accountName}</td><td>{row.amount}</td><td>{row.narration}</td><td>{row.reference}</td><td><button className="view">View</button></td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <style jsx>{`
        .page{min-height:100vh;background:#f6f8f5;color:#173a2e;font-family:Arial,sans-serif;padding:24px}.topbar{max-width:1600px;margin:auto;display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}.brand{display:flex;gap:12px;align-items:center}.brand img{width:46px;height:46px;object-fit:contain;background:#fff;border-radius:9px;padding:4px}.brand small{color:#f28c28;font-weight:800}.brand h1{margin:3px 0;font-size:28px}.back{background:#075c3a;color:#fff;border:0;border-radius:8px;padding:11px 16px;font-weight:700}.panel,.table-panel{max-width:1600px;margin:0 auto 18px;background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 12px #0000000b}.filters{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.filters label{font-size:12px;font-weight:700;color:#5e7068}.filters select,.filters input,.search input{width:100%;box-sizing:border-box;margin-top:6px;padding:11px;border:1px solid #d8e0db;border-radius:8px;background:#fff}.search{display:flex;gap:8px;margin-top:14px}.search input{margin:0;max-width:420px}.search button{border:0;background:#f28c28;color:#fff;border-radius:8px;padding:0 18px;font-weight:700}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:1500px}th,td{padding:11px 9px;border-bottom:1px solid #e8eeea;text-align:left;white-space:nowrap;font-size:13px}th{background:#075c3a;color:#fff;font-size:12px}tr:hover td{background:#fffaf5}.view{border:0;background:#f28c28;color:#fff;border-radius:6px;padding:7px 11px;font-weight:700}@media(max-width:800px){.page{padding:14px}.filters{grid-template-columns:1fr 1fr}.topbar{align-items:flex-start;gap:12px}.brand h1{font-size:22px}}@media(max-width:520px){.filters{grid-template-columns:1fr}.topbar{flex-direction:column}.back{width:100%}}
      `}</style>
    </main>
  );
}
