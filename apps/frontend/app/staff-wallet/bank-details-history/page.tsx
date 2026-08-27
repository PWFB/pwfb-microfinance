'use client';

import { useMemo, useState } from 'react';

const branches = ['All Branches','HEADOFFICE','Dugbe2','Bodija2','SAKI_2','Ilesha_2','dugbe','lalupon','BODIJA_3','OYO_2','IFE BRANCH','ologuneru','OYO_1','Challenge','Osogbo','Igboora','Eruwa','Igbeti_1','apete_1','oje_1','ILORIN BRANCH','sango_2','apata','ashipa branch','Apata_2','Ikire','ayeye','AYETORO','ELEBU','ajagun','New Garage','Testing Branch','Ogbomosho_2','GBAGI INDIVIDUAL1','Gbagi','moniya_2','Amuloko','Lalate branch','Ayeye_2','moniya_3','TEDE BRANCH','Bodija','iwotown','Ilesha 1','AWOTAN','Abeokuta 1','BODIJA INDIVIDUAL','ilorin_2','Osogbo 1','Oloosaoko','moniya_1','ADEGBAYI','OJE_3','MOWE','SANGO_3','Ogbomosho 1','ISEYIN 1','Saki','Ede 1','AKOBO','PAARA IDI OSAN','Akobo_2','olorunsogo','Abeokuta','sango_1','Sango Individual 1','olodo','iwo_road','OLOMI','OKEHO','Sango Individual 2','Dugbe3','Iwo_road2','Shagamu','Igboho','Adegbayi 1','Lanlate','gbagi2','AYEYE 2','Apata 2','Iwo Town'];

type BankRow = { serial: string; date: string; branch: string; area: string; division: string; region: string; bankCode: string; bankName: string; accountNo: string; accountName: string; amount: string; narration: string; reference: string };

// Real records should be supplied by the backend. The empty state prevents fabricated customer/bank data.
const rows: BankRow[] = [];

export default function BankDetailsHistoryPage() {
  const [rm, setRm] = useState('');
  const [dm, setDm] = useState('');
  const [am, setAm] = useState('');
  const [bm, setBm] = useState('');
  const [date, setDate] = useState('');
  const [branch, setBranch] = useState('All Branches');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => rows.filter(row => {
    const text = Object.values(row).join(' ').toLowerCase();
    return (!search || text.includes(search.toLowerCase())) &&
      (branch === 'All Branches' || row.branch === branch) &&
      (!date || row.date === date);
  }), [search, branch, date]);

  const reset = () => { setRm(''); setDm(''); setAm(''); setBm(''); setDate(''); setBranch('All Branches'); setSearch(''); };

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
          <label>Select Branch<select value={branch} onChange={e => setBranch(e.target.value)}>{branches.map(b => <option key={b}>{b}</option>)}</select></label>
          <label>Select date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        </div>
        <div className="search"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search account no, account name, bank, branch, reference..." /><button onClick={reset}>Reset</button></div>
      </section>

      <section className="table-panel">
        <div className="table-title"><div><h2>Bank details history</h2><p>Verification and bank-destination history across PWFB branches.</p></div><span>{filtered.length} record{filtered.length === 1 ? '' : 's'}</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Serial_no</th><th>Date</th><th>Branch</th><th>Area</th><th>Division</th><th>Region</th><th>Bank Code</th><th>Bank Name</th><th>Account no</th><th>Account name</th><th>Amount</th><th>Narration</th><th>Reference no</th><th>Action</th></tr></thead>
            <tbody>{filtered.length ? filtered.map(row => <tr key={row.serial}>{[row.serial,row.date,row.branch,row.area,row.division,row.region,row.bankCode,row.bankName,row.accountNo,row.accountName,row.amount,row.narration,row.reference].map((v,i)=><td key={i}>{v}</td>)}<td><button className="view">View</button></td></tr>) : <tr><td colSpan={14} className="empty">No bank details history records found.</td></tr>}</tbody>
          </table>
        </div>
      </section>
      <style jsx>{`
        .page{min-height:100vh;background:#f6f8f5;color:#173a2e;font-family:Arial,sans-serif;padding:24px}.topbar{max-width:1700px;margin:auto;display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}.brand{display:flex;gap:12px;align-items:center}.brand img{width:46px;height:46px;object-fit:contain;background:#fff;border-radius:9px;padding:4px}.brand small{color:#f28c28;font-weight:800}.brand h1{margin:3px 0;font-size:28px}.back{background:#075c3a;color:#fff;border:0;border-radius:8px;padding:11px 16px;font-weight:700;cursor:pointer}.panel,.table-panel{max-width:1700px;margin:0 auto 18px;background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 12px #0000000b}.filters{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}.filters label{font-size:12px;font-weight:700;color:#5e7068}.filters select,.filters input,.search input{width:100%;box-sizing:border-box;margin-top:6px;padding:11px;border:1px solid #d8e0db;border-radius:8px;background:#fff}.search{display:flex;gap:8px;margin-top:14px}.search input{margin:0;max-width:560px}.search button{border:0;background:#f28c28;color:#fff;border-radius:8px;padding:0 18px;font-weight:700;cursor:pointer}.table-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.table-title h2{margin:0;font-size:18px}.table-title p{margin:5px 0 0;color:#718078;font-size:12px}.table-title span{background:#eef8f2;color:#075c3a;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:800}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:1550px}th,td{padding:11px 9px;border-bottom:1px solid #e8eeea;text-align:left;white-space:nowrap;font-size:13px}th{background:#075c3a;color:#fff;font-size:12px}tr:hover td{background:#fffaf5}.view{border:0;background:#f28c28;color:#fff;border-radius:6px;padding:7px 11px;font-weight:700}.empty{text-align:center!important;padding:55px!important;color:#718078!important}@media(max-width:900px){.page{padding:14px}.filters{grid-template-columns:1fr 1fr}.topbar{align-items:flex-start;gap:12px}}@media(max-width:520px){.filters{grid-template-columns:1fr}.topbar{flex-direction:column}.back{width:100%}}
      `}</style>
    </main>
  );
}
