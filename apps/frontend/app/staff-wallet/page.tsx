'use client';

import { useMemo, useState } from 'react';

const branches = [
  'Region_2','Region_1','REGION_3','REGION4','none','Am_1b','Dugbe2','Bodija2','SAKI_2','Ilesha_2','dugbe','lalupon','BODIJA_3','OYO_2','IFE BRANCH','ologuneru','OYO_1','Challenge individual','Osogbo','Igboora','Eruwa','Igbeti_1','apete_1','oje_1','ILORIN BRANCH','sango_2','apata','ashipa branch','Apata_2','Ikire','ayeye','AYETORO','ELEBU','ajagun','New Garage','Testing Branch','Ogbomosho_2','GBAGI INDIVIDUAL1','Gbagi','moniya_2','Amuloko','Lalate branch','Ayeye_2','moniya_3','TEDE BRANCH','Bodija','iwotown','Ilesha 1','AWOTAN','Abeokuta 1','BODIJA INDIVIDUAL','ilorin_2','Osogbo 1','Oloosaoko','moniya_1','ADEGBAYI','OJE_3','MOWE','SANGO_3','Ogbomosho 1','ISEYIN 1','Saki','Ede 1','AKOBO','PAARA IDI OSAN','Akobo_2','Challenge','olorunsogo','Abeokuta','sango_1','Sango Individual 1','olodo','iwo_road','OLOMI','OKEHO','Sango Individual 2','Dugbe3','Iwo_road2','Shagamu','Igboho','Adegbayi 1','Lanlate','gbagi2','AYEYE 2','Apata 2','HEADOFFICE','DUGBE_2','Iwo Town'
];
const tools = ['Fill Cashbook','Fill Savings','Fill Weekly Loan','Fill Loan',"Fill CO's Savings","Fill CO's Weekly Loan","Fill CO's Loan",'Weekly Opening Balance','Daily Collection','Savings Summary','Loan Summary','Weekly Loan Summary','Edit Weekly Loan Summary','Loan Clients','Bank Details history','Total Amount Received From Branch','Bank Transaction','Cash Book','Delete Branch','Add Branch','Add Area','Add Division','Add Region','Move Branch','Move Area','Move Division','Move CO','Sack staff','View Staffs','Edit Cashbook','Edit Bank Transaction','Edit Expenses','Edit Daily Collection','Edit Loan Disbursement','Edit Saving Summary','Edit Loan Summary','Edit Finance Service',"Edit CO's Saving Summary","Edit CO's Loan Summary","Edit CO's Weekly Loan Summary",'CEO Monthly','CEO Collector','My Inbox','Compose Mail','Sent Mail','Add Staff','Add CO','Sack CO','Delete Images'];

export default function StaffWalletPage() {
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState('HEADOFFICE');
  const [open, setOpen] = useState(true);
  const filtered = useMemo(() => branches.filter(b => b.toLowerCase().includes(query.toLowerCase())), [query]);

  const handleTool = (tool: string) => {
    if (tool === 'Bank Details history') {
      window.location.href = '/staff-wallet/bank-details-history';
      return;
    }
    alert(`${tool} — ${branch}`);
  };

  return (
    <main className="staff-wallet">
      <aside className={open ? 'sidebar' : 'sidebar collapsed'}>
        <div className="brand"><img src="/pwfb-logo.svg" alt="PWFB" /><span>PWFB STAFF WALLET</span></div>
        <button className="toggle" onClick={() => setOpen(!open)}>{open ? '‹' : '›'}</button>
        {open && <><label>Branch</label><select value={branch} onChange={e => setBranch(e.target.value)}>{branches.map(b => <option key={b}>{b}</option>)}</select><nav>{tools.map(t => <button key={t} onClick={() => handleTool(t)}>{t}</button>)}</nav></>}
      </aside>
      <section className="content">
        <header><div><small>PWFB STAFF WALLET</small><h1>{branch}</h1><p>Manage, review and edit branch operations.</p></div><button className="logout">Logout</button></header>
        <div className="cards"><div><b>Opening Balance</b><strong>₦0.00</strong></div><div><b>Daily Collection</b><strong>₦0.00</strong></div><div><b>Savings</b><strong>₦0.00</strong></div><div><b>Loans</b><strong>₦0.00</strong></div></div>
        <div className="panel"><h2>All Branches</h2><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search branch"/><div className="branches">{filtered.map(b => <button className={b === branch ? 'active' : ''} key={b} onClick={() => setBranch(b)}>{b}</button>)}</div></div>
      </section>
      <style jsx>{`.staff-wallet{min-height:100vh;display:flex;background:#f6f8f5;color:#12352a;font-family:Arial,sans-serif}.sidebar{width:270px;background:#075c3a;color:white;padding:18px;position:sticky;top:0;height:100vh;overflow:auto;box-sizing:border-box}.sidebar.collapsed{width:64px}.brand{display:flex;align-items:center;gap:10px;font-weight:800;margin-bottom:22px}.brand img{width:42px;height:42px;object-fit:contain;background:white;border-radius:9px;padding:4px}.toggle{position:absolute;right:10px;top:18px;border:0;border-radius:7px;background:#f28c28;color:white;font-size:24px;width:34px;height:34px}.sidebar label{font-size:12px;opacity:.8}.sidebar select{width:100%;margin:6px 0 14px;padding:10px;border-radius:8px;border:0}nav{display:grid;gap:5px}nav button{background:transparent;border:0;color:white;text-align:left;padding:9px;border-radius:7px;cursor:pointer}nav button:hover{background:#f28c28}.content{flex:1;padding:30px;max-width:1500px}header{display:flex;justify-content:space-between;align-items:center}h1{margin:4px 0;font-size:30px}small{color:#f28c28;font-weight:800}.logout{border:0;background:#075c3a;color:white;padding:11px 18px;border-radius:8px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin:28px 0}.cards div,.panel{background:white;border-radius:14px;padding:20px;box-shadow:0 2px 12px #0000000b}.cards b{display:block;font-size:13px;color:#68776f}.cards strong{font-size:24px;display:block;margin-top:10px}.panel h2{display:inline-block;margin:0 20px 15px 0}.panel input{padding:11px;border:1px solid #d8e0db;border-radius:8px;width:240px}.branches{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.branches button{padding:12px;text-align:left;border:1px solid #e1e7e3;background:#fafcfb;border-radius:8px}.branches button.active{border-color:#f28c28;background:#fff3e7;font-weight:700}@media(max-width:900px){.cards{grid-template-columns:repeat(2,1fr)}.branches{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.sidebar{width:220px}.content{padding:18px}.cards{grid-template-columns:1fr}.branches{grid-template-columns:1fr}}`}</style>
    </main>
  );
}
