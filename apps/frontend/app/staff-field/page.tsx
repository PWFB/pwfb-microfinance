"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";

type Customer={id:string;firstName:string;lastName:string;phone?:string;branch?:{name:string}};
type Payment={id:string;amount:number;type:string;source?:string;status?:string;createdAt:string;customer?:Customer;provider?:string};
type Collection={id:string;type:string;amount:number;notes?:string;collectionDate:string;customer?:Customer};

const money=(v:number)=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(Number(v)||0);

export default function StaffFieldPage(){
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [payments,setPayments]=useState<Payment[]>([]);
  const [collections,setCollections]=useState<Collection[]>([]);
  const [customerId,setCustomerId]=useState("");
  const [type,setType]=useState<"SAVINGS"|"LOAN_REPAYMENT">("SAVINGS");
  const [amount,setAmount]=useState("");
  const [method,setMethod]=useState<"CASH"|"DEPOSIT">("CASH");
  const [search,setSearch]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);

  async function load(){
    try{
      setError("");
      const [c,p,col]=await Promise.all([apiRequest("/customers"),apiRequest("/transactions"),apiRequest("/collections")]);
      setCustomers(Array.isArray(c)?c:[]); setPayments(Array.isArray(p)?p:[]); setCollections(Array.isArray(col)?col:[]);
    }catch(e:any){setError(e?.message||"Unable to load field records.");}
  }
  useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(!q)return customers;
    return customers.filter(c=>[c.id,c.firstName,c.lastName,c.phone].filter(Boolean).join(" ").toLowerCase().includes(q));
  },[customers,search]);

  async function submit(e:React.FormEvent){
    e.preventDefault(); setMessage(""); setError("");
    if(!customerId){setError("Select your client first.");return}
    const n=Number(amount); if(!Number.isFinite(n)||n<=0){setError("Enter a valid amount.");return}
    try{
      setSaving(true);
      await apiRequest("/collections",{method:"POST",body:JSON.stringify({customerId,type,amount:n,paymentMethod:method})});
      setAmount(""); setMessage("Collection entered. The branch manager can now reconcile and complete office processing."); await load();
    }catch(e:any){setError(e?.message||"Unable to save collection.");}finally{setSaving(false)}
  }

  return <main className="field-page">
    <header className="hero"><div><span>PWFB • FIELD STAFF</span><h1>My Field Work</h1><p>Register clients, enter cash or deposit collections, and view client payment/transfer activity. Payment activity is read-only.</p></div><div className="count"><strong>{customers.length}</strong><small>My registered clients</small></div></header>
    {message&&<div className="notice success">{message}</div>}{error&&<div className="notice error">{error}</div>}
    <section className="grid">
      <article className="panel"><div className="title"><div><span>INPUT ONLY</span><h2>Record client collection</h2></div></div>
        <form onSubmit={submit}>
          <label>Find my client</label><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, phone or client ID"/>
          <select value={customerId} onChange={e=>setCustomerId(e.target.value)} required><option value="">Select client</option>{filtered.map(c=><option key={c.id} value={c.id}>{c.firstName+" "+c.lastName+" — "+c.id}</option>)}</select>
          <div className="two"><div><label>Collection</label><select value={type} onChange={e=>setType(e.target.value as "SAVINGS"|"LOAN_REPAYMENT")}><option value="SAVINGS">Savings deposit</option><option value="LOAN_REPAYMENT">Loan payment</option></select></div><div><label>Amount</label><input type="number" min="1" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="₦0" required/></div></div>
          <label>Payment received</label><select value={method} onChange={e=>setMethod(e.target.value as "CASH"|"DEPOSIT")}><option value="CASH">Cash</option><option value="DEPOSIT">Deposit</option></select>
          <button disabled={saving}>{saving?"Saving...":"Submit collection"}</button>
          <p className="hint">Staff cannot edit, reconcile or delete submitted records. The branch manager handles the office report and final reconciliation.</p>
        </form>
      </article>
      <article className="panel"><div className="title"><div><span>MY CLIENTS</span><h2>Registered by me</h2></div><small>{customers.length} clients</small></div>
        <div className="list">{customers.map(c=><div className="row" key={c.id}><div className="avatar">{c.firstName.slice(0,1)+c.lastName.slice(0,1)}</div><div><strong>{c.firstName+" "+c.lastName}</strong><small>{c.id+" • "+(c.phone||"No phone")}</small></div><span>{c.branch?.name||"Assigned branch"}</span></div>)}{!customers.length&&<p className="empty">No clients registered by you yet.</p>}</div>
      </article>
    </section>
    <section className="panel"><div className="title"><div><span>READ ONLY</span><h2>Client payment & transfer activity</h2></div><small>System-generated activity cannot be edited by staff.</small></div>
      <div className="table"><table><thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Amount</th><th>Source</th><th>Status</th></tr></thead><tbody>
      {payments.map(p=><tr key={p.id}><td>{new Date(p.createdAt).toLocaleString("en-NG")}</td><td>{p.customer?p.customer.firstName+" "+p.customer.lastName:p.id}</td><td>{p.type}</td><td><strong>{money(p.amount)}</strong></td><td>{p.source||p.provider||"SYSTEM"}</td><td>{p.status||"COMPLETED"}</td></tr>)}{!payments.length&&<tr><td colSpan={6}>No client payment activity yet.</td></tr>}</tbody></table></div>
    </section>
    <section className="panel"><div className="title"><div><span>MY INPUTS</span><h2>Collections entered</h2></div></div>
      <div className="table"><table><thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody>
      {collections.map(c=><tr key={c.id}><td>{new Date(c.collectionDate).toLocaleString("en-NG")}</td><td>{c.customer?c.customer.firstName+" "+c.customer.lastName:"—"}</td><td>{c.type}</td><td>{c.notes?.split(" • ")[0]||"CASH"}</td><td><strong>{money(c.amount)}</strong></td><td>PENDING BRANCH REVIEW</td></tr>)}{!collections.length&&<tr><td colSpan={6}>No collections entered yet.</td></tr>}</tbody></table></div>
    </section>
    <style jsx>{`
      .field-page{max-width:1400px;margin:0 auto;padding:8px 0 48px}.hero{display:flex;justify-content:space-between;gap:20px;padding:30px;border-radius:22px;background:linear-gradient(120deg,#075b2b,#0f7b35);color:#fff}.hero span,.title span{font-size:10px;font-weight:900;letter-spacing:.14em}.hero h1{margin:8px 0;font-size:36px}.hero p{margin:0;max-width:700px;color:#d9eee0;line-height:1.6}.count{min-width:170px;padding:18px;border:1px solid #ffffff30;border-radius:15px;background:#ffffff12}.count strong{display:block;font-size:30px}.count small{color:#d9eee0}.grid{display:grid;grid-template-columns:1fr 1.2fr;gap:16px;margin:16px 0}.panel{padding:22px;border:1px solid var(--pwfb-border);border-radius:18px;background:#fff;box-shadow:var(--pwfb-shadow);margin-bottom:16px}.title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px}.title span{color:var(--pwfb-green)}.title h2{margin:4px 0 0;font-size:20px}.title small{color:#738078}label{display:block;margin:12px 0 6px;font-size:12px;font-weight:800;color:#526059}input,select{width:100%;min-height:44px;padding:10px 12px;border:1px solid #dce5df;border-radius:10px;background:#fff}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}button{width:100%;margin-top:15px;min-height:46px;border:0;border-radius:10px;background:var(--pwfb-orange);color:#fff;font-weight:900}button:disabled{opacity:.6}.hint{font-size:11px;color:#78847d;line-height:1.5}.list{max-height:340px;overflow:auto}.row{display:flex;align-items:center;gap:11px;padding:12px 0;border-bottom:1px solid #edf1ee}.avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--pwfb-green-light);color:var(--pwfb-green);font-size:11px;font-weight:900}.row div:nth-child(2){flex:1}.row strong,.row small{display:block}.row small{margin-top:3px;color:#7b867f;font-size:10px}.row span{font-size:10px;color:#748078}.table{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:11px 9px;border-bottom:1px solid #edf1ee;text-align:left;white-space:nowrap}th{font-size:10px;color:#738078;text-transform:uppercase;letter-spacing:.06em}.notice{margin:14px 0;padding:12px 15px;border-radius:10px;font-size:12px}.success{background:#e9f7ee;color:#176a38}.error{background:#fff0ec;color:#a43b21}.empty{color:#7b867f;font-size:12px}@media(max-width:900px){.grid{grid-template-columns:1fr}.hero{flex-direction:column}.count{min-width:0}.two{grid-template-columns:1fr}}
    `}</style>
  </main>
}
