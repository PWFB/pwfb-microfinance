'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Branch={id:string;name:string};
type Period={id:string;name:string;status?:string};
type Row={id:string;entryDate:string;description?:string;branch?:{name:string};[key:string]:any};

const pageOne=[
  ['previousCashAtHand','Previous Cash at Hand'],['dailyCashInHand','Daily Cash In-Hand'],['savingsDeposits','Savings Deposits'],
  ['dailyInstallmentCollection','Daily Installment Collection'],['monthlyCollection','Monthly Collection'],['memberRegistration','Member Registration'],
  ['riskPremium','Risk Premium'],['passbookSales','Passbook Sales'],
] as const;
const pageTwo=[
  ['loanDisbursement','Loan Disbursement'],['bankDeposit','Bank Deposit'],['savingsWithdrawal','Savings Withdrawal'],
  ['savingsReturnedAdjustment','Savings Returned/Adjustment'],['fundTransfer','Fund Transfer'],['other','Other'],
] as const;
const empty={entryDate:new Date().toISOString().slice(0,10),description:'',previousCashAtHand:'0',dailyCashInHand:'0',savingsDeposits:'0',dailyInstallmentCollection:'0',monthlyCollection:'0',memberRegistration:'0',riskPremium:'0',passbookSales:'0',loanDisbursement:'0',bankDeposit:'0',savingsWithdrawal:'0',savingsReturnedAdjustment:'0',fundTransfer:'0',other:'0',narration:'',referenceNo:''};
const money=(v:any)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(Number(v)||0);
const n=(v:string)=>Number(v||0);

export default function CashbookPage(){
  const [branches,setBranches]=useState<Branch[]>([]),[periods,setPeriods]=useState<Period[]>([]),[branchId,setBranchId]=useState(''),[periodId,setPeriodId]=useState('');
  const [rows,setRows]=useState<Row[]>([]),[form,setForm]=useState(empty),[editingId,setEditingId]=useState<string|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const fields=[...pageOne,...pageTwo].map(x=>x[0]);
  const total=useMemo(()=>fields.reduce((s,k)=>s+n(form[k]),0),[form]);
  const set=(key:string,value:string)=>setForm(f=>({...f,[key]:value}));
  async function loadBase(){try{const [b,p]=await Promise.all([apiRequest('/branches'),apiRequest('/periods')]);const bs=Array.isArray(b)?b:[],ps=Array.isArray(p)?p:[];setBranches(bs);setPeriods(ps);if(!branchId&&bs[0])setBranchId(bs[0].id);if(!periodId){const open=ps.find((x:Period)=>x.status==='OPEN')||ps[0];if(open)setPeriodId(open.id);}}catch(e:any){setError(e.message||'Unable to load cashbook settings.')}}
  async function loadRows(){try{setLoading(true);const q=new URLSearchParams();if(periodId)q.set('periodId',periodId);if(branchId)q.set('branchId',branchId);const data=await apiRequest(`/cashbook/daily?${q}`);setRows(Array.isArray(data)?data:[]);}catch(e:any){setError(e.message||'Unable to load cashbook.')}finally{setLoading(false)}}
  useEffect(()=>{loadBase()},[]); useEffect(()=>{if(periodId||branchId)loadRows()},[periodId,branchId]);
  async function submit(e:React.FormEvent){e.preventDefault();setSaving(true);setError('');setMessage('');try{const payload:any={periodId,branchId,entryDate:form.entryDate,description:form.description,narration:form.narration,referenceNo:form.referenceNo};for(const k of fields)payload[k]=n(form[k]);if(editingId)await apiRequest(`/cashbook/daily/${editingId}`,{method:'PATCH',body:JSON.stringify(payload)});else await apiRequest('/cashbook/daily',{method:'POST',body:JSON.stringify(payload)});setMessage(editingId?'Cash Book record updated.':'Cash Book record saved.');setEditingId(null);setForm(empty);await loadRows()}catch(e:any){setError(e.message||'Unable to save Cash Book record.')}finally{setSaving(false)}}
  function edit(r:Row){const next:any={...empty,entryDate:new Date(r.entryDate).toISOString().slice(0,10),description:r.description||''};for(const k of fields)next[k]=String(r[k]||0);next.narration=r.narration||'';next.referenceNo=r.referenceNo||'';setForm(next);setEditingId(r.id);window.scrollTo({top:0,behavior:'smooth'})}
  async function remove(id:string){if(!confirm('Delete this Cash Book record?'))return;try{await apiRequest(`/cashbook/daily/${id}`,{method:'DELETE'});setMessage('Cash Book record deleted.');await loadRows()}catch(e:any){setError(e.message||'Unable to delete record.')}}

  return <main className="pb-10">
    <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">FINANCE & ACCOUNTS</p><h1 className="pwfb-page-title">Cash Book</h1><p className="pwfb-page-description">Simple digital version of the PWFB paper Cash Book.</p></div><Link href="/dashboard" className="pwfb-secondary-button">← Dashboard</Link></div>
    {error&&<div className="pwfb-alert mb-4">{error}</div>}{message&&<div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
    <section className="pwfb-panel mb-5"><div className="pwfb-panel-header"><div><h2>{editingId?'Edit Cash Book':'New Cash Book Entry'}</h2><p>Swipe left or right to move between the two Cash Book pages.</p></div><strong className="text-emerald-700">{money(total)}</strong></div>
      <form onSubmit={submit} className="p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-4"><label>Date<input type="date" value={form.entryDate} onChange={e=>set('entryDate',e.target.value)} required/></label><label>Description<input value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Description"/></label><label>Financial Period<select value={periodId} onChange={e=>setPeriodId(e.target.value)} required><option value="">Select period</option>{periods.map(p=><option key={p.id} value={p.id}>{p.name}{p.status==='CLOSED'?' — CLOSED':''}</option>)}</select></label><label>Branch<select value={branchId} onChange={e=>setBranchId(e.target.value)} required><option value="">Select branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label></div>
        <div className="overflow-x-auto rounded-xl border border-emerald-100"><div className="flex min-w-[1500px] snap-x snap-mandatory">
          <section className="min-w-full snap-start p-3"><h3 className="mb-3 text-base font-bold text-emerald-900">Page 1 — Receipts / Cash In</h3><div className="grid grid-cols-4 gap-3">{pageOne.map(([k,l])=><label key={k}>{l}<input type="number" min="0" step="0.01" value={form[k]} onChange={e=>set(k,e.target.value)}/></label>)}</div></section>
          <section className="min-w-full snap-start border-l border-emerald-100 p-3"><h3 className="mb-3 text-base font-bold text-emerald-900">Page 2 — Payments / Cash Out</h3><div className="grid grid-cols-3 gap-3">{pageTwo.map(([k,l])=><label key={k}>{l}<input type="number" min="0" step="0.01" value={form[k]} onChange={e=>set(k,e.target.value)}/></label>)}<label>Total<input value={money(total)} readOnly/></label></div></section>
        </div></div>
        <div className="grid gap-3 md:grid-cols-2"><label>Narration<textarea value={form.narration} onChange={e=>set('narration',e.target.value)} placeholder="Optional narration"/></label><label>Reference No.<input value={form.referenceNo} onChange={e=>set('referenceNo',e.target.value)} placeholder="Receipt/reference number"/></label></div>
        <div className="flex flex-wrap justify-between gap-2"><span className="text-xs text-slate-500">Swipe the ledger left/right on mobile.</span><div className="flex gap-2"><button type="submit" disabled={saving||!periodId||!branchId} className="pwfb-primary-button">{saving?'Saving…':editingId?'Update Record':'Save Cash Book'}</button>{editingId&&<button type="button" className="pwfb-secondary-button" onClick={()=>{setEditingId(null);setForm(empty)}}>Cancel</button>}</div></div>
      </form>
    </section>

    <section className="pwfb-panel"><div className="pwfb-panel-header"><div><h2>Cash Book Records</h2><p>The first page is shown first. Swipe horizontally to see the second page.</p></div><span className="pwfb-record-count">{rows.length} records</span></div>
      <div className="overflow-x-auto"><div className="flex min-w-[1800px] snap-x snap-mandatory">
        <section className="min-w-[900px] snap-start p-4"><h3 className="mb-3 font-bold text-emerald-900">Page 1</h3><table className="pwfb-table min-w-[1700px]"><thead><tr><th>Date</th><th>Description</th>{pageOne.map(([,l])=><th key={l}>{l}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{new Date(r.entryDate).toLocaleDateString('en-NG')}</td><td>{r.description||'—'}</td>{pageOne.map(([k])=><td key={k}>{money(r[k])}</td>)}</tr>)}{!loading&&!rows.length&&<tr><td colSpan={10}>No Cash Book records found.</td></tr>}</tbody></table></section>
        <section className="min-w-[900px] snap-start border-l border-emerald-100 p-4"><h3 className="mb-3 font-bold text-emerald-900">Page 2</h3><table className="pwfb-table min-w-[1300px]"><thead><tr>{pageTwo.map(([,l])=><th key={l}>{l}</th>)}<th>Total</th><th>Action</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}>{pageTwo.map(([k])=><td key={k}>{money(r[k])}</td>)}<td><strong>{money(r.totalAmount)}</strong></td><td><div className="flex gap-2"><button className="pwfb-secondary-button" onClick={()=>edit(r)}>Edit</button><button className="pwfb-secondary-button" onClick={()=>remove(r.id)}>Delete</button></div></td></tr>)}{!loading&&!rows.length&&<tr><td colSpan={8}>No Cash Book records found.</td></tr>}{loading&&<tr><td colSpan={8}>Loading Cash Book…</td></tr>}</tbody></table></section>
      </div></div>
    </section>
  </main>;
}
