"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";

type Branch={id:string;name:string};
type Period={id:string;name:string;status?:string};
type Staff={id:string;firstName?:string;lastName?:string;position?:string;branchId?:string};
type Row={id:string;entryDate:string;description?:string;referenceNo?:string;staffId?:string;branch?:{name?:string};[key:string]:any};

const receipts=[
  ["previousCashAtHand","Previous day's cash-in-hand"],
  ["savingsDeposits","Savings deposition"],
  ["dailyCollection","Daily installment collection"],
  ["weeklyCollection","Weekly collection"],
  ["monthlyCollection","Monthly collection"],
  ["monitorRegistrationFees","Member registration fees"],
  ["riskPremium","Risk Premium"],
  ["passbookSales","Pass-book Sale"],
  ["loanApplicationForm","Loan application form"],
  ["withdrawalFromBank","Withdrawal from bank"],
  ["fundReceivedHeadOffice","Fund received from Head Office"],
  ["fundReceivedBranchOther","Branch Other"],
  ["receiptOthers","Others"],
] as const;

const payments=[
  ["dailyDisbursementCount","Daily loan No."],
  ["weeklyDisbursementCount","Weekly loan No."],
  ["monthlyDisbursementCount","Monthly loan No."],
  ["bankDeposit","Bank deposit"],
  ["savingsWithdrawalCount","Savings withdrawal No."],
  ["savingsReturnedDW","Savings returned — D/W"],
  ["savingsReturnedCash","Savings returned — Cash"],
  ["savingsReturnedAdjust","Savings returned — Adjust"],
  ["fundTransferHeadOffice","Fund transfer to Head Office"],
  ["fundTransferBranch","Fund transfer to Branch"],
  ["others","Other"],
] as const;

const moneyFields=[
  "previousCashAtHand","savingsDeposits","dailyCollection","weeklyCollection","monthlyCollection",
  "monitorRegistrationFees","riskPremium","passbookSales","loanApplicationForm","withdrawalFromBank",
  "fundReceivedHeadOffice","fundReceivedBranchOther","receiptOthers","dailyDisbursementAmount",
  "weeklyDisbursementAmount","monthlyDisbursementAmount","bankDeposit","savingsWithdrawalAmount",
  "savingsReturnedDW","savingsReturnedCash","savingsReturnedAdjust","fundTransferHeadOffice",
  "fundTransferBranch","others"
];

const all=[...new Set([...receipts.map(x=>x[0]),...payments.map(x=>x[0]),...moneyFields])];

const blank=()=>{const x:any={entryDate:new Date().toISOString().slice(0,10),description:"",referenceNo:"",staffId:""};for(const k of all)x[k]="0";return x;};
const n=(v:any)=>Math.max(0,Number(v)||0);
const money=(v:any)=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(Number(v)||0);

function receiptTotal(r:any){
  return receipts.reduce((s,[k])=>s+n(r[k]),0);
}
function paymentTotal(r:any){
  return n(r.dailyDisbursementAmount)+n(r.weeklyDisbursementAmount)+n(r.monthlyDisbursementAmount)+n(r.bankDeposit)+n(r.savingsWithdrawalAmount)+n(r.savingsReturnedDW)+n(r.savingsReturnedCash)+n(r.savingsReturnedAdjust)+n(r.fundTransferHeadOffice)+n(r.fundTransferBranch)+n(r.others);
}
function weekOfMonth(dateValue:string){
  const d=new Date(dateValue);
  return Math.floor((d.getDate()-1)/7)+1;
}

export default function CashbookPage(){
  const [branches,setBranches]=useState<Branch[]>([]);
  const [periods,setPeriods]=useState<Period[]>([]);
  const [staff,setStaff]=useState<Staff[]>([]);
  const [branchId,setBranchId]=useState("");
  const [periodId,setPeriodId]=useState("");
  const [form,setForm]=useState<any>(blank());
  const [rows,setRows]=useState<Row[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");

  const set=(k:string,v:string)=>setForm((x:any)=>({...x,[k]:v}));

  async function init(){
    try{
      const [b,p]=await Promise.all([apiRequest("/branches"),apiRequest("/periods")]);
      const bs=Array.isArray(b)?b:[], ps=Array.isArray(p)?p:[];
      setBranches(bs); setPeriods(ps);
      if(bs[0]) setBranchId(bs[0].id);
      const open=ps.find((x:Period)=>x.status==="OPEN")||ps[0];
      if(open) setPeriodId(open.id);
    }catch(e:any){setError(e?.message||"Unable to load cashbook settings");}
  }

  async function loadStaff(){
    try{const s=await apiRequest("/staff");setStaff(Array.isArray(s)?s:[]);}catch{setStaff([]);}
  }

  async function load(){
    if(!periodId||!branchId)return;
    try{
      setLoading(true);
      const q=new URLSearchParams({periodId,branchId});
      if(from)q.set("from",from);
      if(to)q.set("to",`${to}T23:59:59`);
      const d=await apiRequest(`/cashbook/daily?${q}`);
      setRows(Array.isArray(d)?d:[]);
    }catch(e:any){setError(e?.message||"Unable to load cashbook");}
    finally{setLoading(false);}
  }

  useEffect(()=>{void init();void loadStaff();},[]);
  useEffect(()=>{void load();},[periodId,branchId,from,to]);

  async function submit(e:React.FormEvent){
    e.preventDefault(); setError("");setMessage("");
    if(!periodId||!branchId)return setError("Select a financial period and branch.");
    if(receiptTotal(form)<=0&&paymentTotal(form)<=0)return setError("Enter at least one cashbook amount.");
    setSaving(true);
    try{
      const body:any={periodId,branchId,entryDate:form.entryDate,description:form.description,referenceNo:form.referenceNo,staffId:form.staffId||undefined};
      for(const k of all)body[k]=n(form[k]);
      await apiRequest("/cashbook/daily",{method:"POST",body:JSON.stringify(body)});
      setMessage("Cashbook row posted successfully.");
      setForm(blank());
      await load();
    }catch(e:any){setError(e?.message||"Unable to post cashbook row");}
    finally{setSaving(false);}
  }

  const weekly=useMemo(()=>{
    const groups=new Map<number,Row[]>();
    for(const r of rows){const w=weekOfMonth(r.entryDate);if(!groups.has(w))groups.set(w,[]);groups.get(w)!.push(r);}
    return Array.from(groups.entries()).sort((a,b)=>a[0]-b[0]);
  },[rows]);

  const monthReceipts=rows.reduce((s,r)=>s+receiptTotal(r),0);
  const monthPayments=rows.reduce((s,r)=>s+paymentTotal(r),0);

  return <main className="min-h-screen bg-slate-100 p-3 text-slate-900 md:p-6">
    <div className="mx-auto max-w-[1800px]">
      <header className="mb-4 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-[.18em] text-emerald-700">PERFECT WISDOM FOR BETTER MICROFINANCE</p>
            <h1 className="text-2xl font-black text-emerald-950">Cash Book</h1>
            <p className="text-sm text-slate-500">Physical cashbook layout — receipts/debit and payments/credit.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white">Dashboard</Link>
            <Link href="/staff-wallet" className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-white">Staff Wallet</Link>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="field">Cash Book for the Month<select value={periodId} onChange={e=>setPeriodId(e.target.value)}>{periods.map(p=><option key={p.id} value={p.id}>{p.name}{p.status==="CLOSED"?" — CLOSED":""}</option>)}</select></label>
          <label className="field">Branch<select value={branchId} onChange={e=>{setBranchId(e.target.value);set("staffId","")}}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label className="field">From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
          <label className="field">To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
        </div>
      </header>

      {error&&<div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
      {message&&<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</div>}

      <section className="mb-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-emerald-950 p-4 text-white">
          <h2 className="font-black">New Daily Cash Book Entry</h2>
          <p className="text-xs text-emerald-100">Enter the same columns shown in the PWFB physical cashbook.</p>
        </div>
        <form onSubmit={submit} className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="field">Date<input type="date" value={form.entryDate} onChange={e=>set("entryDate",e.target.value)}/></label>
            <label className="field">Description<input value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Customer / daily description"/></label>
            <label className="field">Field staff / collector<select value={form.staffId} onChange={e=>set("staffId",e.target.value)}><option value="">Not assigned</option>{staff.filter(s=>!s.branchId||s.branchId===branchId).map(s=><option key={s.id} value={s.id}>{s.firstName} {s.lastName} — {s.position||"Staff"}</option>)}</select></label>
            <label className="field">Reference<input value={form.referenceNo} onChange={e=>set("referenceNo",e.target.value)} placeholder="Voucher / reference"/></label>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <EntryGroup title="Receipts / Debit" items={receipts} form={form} set={set}/>
            <EntryGroup title="Payments / Credit" items={payments} form={form} set={set} payment/>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
            <div className="text-sm"><b>Receipt total:</b> {money(receiptTotal(form))} <span className="mx-3"><b>Payment total:</b> {money(paymentTotal(form))}</span><b>Balance:</b> {money(receiptTotal(form)-paymentTotal(form))}</div>
            <button disabled={saving} className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{saving?"Posting…":"Post Daily Row"}</button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-black text-emerald-950">Cash Book for the Month</h2><p className="text-xs text-slate-500">Weekly totals and monthly total follow the physical register structure.</p></div>
            <div className="text-sm font-bold">Monthly receipts {money(monthReceipts)} · payments {money(monthPayments)} · balance {money(monthReceipts-monthPayments)}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1900px]">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-emerald-950 text-white">
                  <th colSpan={15} className="border p-2 text-left text-sm">Receipts / Debit</th>
                  <th colSpan={12} className="border p-2 text-left text-sm">Payments / Credit</th>
                </tr>
                <tr className="bg-emerald-50 text-emerald-950">
                  <th className="border p-2">Date</th><th className="border p-2 min-w-[120px]">Description</th>
                  {receipts.map(([k,l])=><th key={k} className="border p-2 min-w-[92px]">{l}</th>)}
                  <th className="border p-2 min-w-[105px]">Receipt Total</th>
                  {payments.map(([k,l])=><th key={k} className="border p-2 min-w-[88px]">{l}</th>)}
                  <th className="border p-2 min-w-[105px]">Payment Total</th>
                  <th className="border p-2 min-w-[105px]">Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading?<tr><td colSpan={29} className="border p-8 text-center">Loading…</td></tr>:
                  weekly.length===0?<tr><td colSpan={29} className="border p-8 text-center text-slate-500">No cashbook entries for this period.</td></tr>:
                  weekly.map(([week,items])=><WeekRows key={week} week={week} items={items} staff={staff}/>)
                }
              </tbody>
              <tfoot>
                <tr className="bg-emerald-900 font-black text-white">
                  <td colSpan={2} className="border p-2">Monthly Total</td>
                  {receipts.map(([k])=><td key={k} className="border p-2 text-right">{money(rows.reduce((s,r)=>s+n(r[k]),0))}</td>)}
                  <td className="border p-2 text-right">{money(monthReceipts)}</td>
                  {payments.map(([k])=><td key={k} className="border p-2 text-right">{money(rows.reduce((s,r)=>n(s)+n(r[k]),0))}</td>)}
                  <td className="border p-2 text-right">{money(monthPayments)}</td>
                  <td className="border p-2 text-right">{money(monthReceipts-monthPayments)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div className="border-t p-4 text-xs font-bold text-slate-500">BM Register / BM (Name & Sign.) · Physical sheet columns preserved; use horizontal scrolling on small screens.</div>
      </section>
    </div>
  </main>;
}

function EntryGroup({title,items,form,set,payment=false}:{title:string;items:readonly (readonly [string,string])[];form:any;set:(k:string,v:string)=>void;payment?:boolean}){
  return <div className={`rounded-xl border ${payment?"border-orange-200":"border-emerald-200"}`}>
    <div className={`border-b p-3 font-black ${payment?"bg-orange-50 text-orange-800":"bg-emerald-50 text-emerald-900"}`}>{title}</div>
    <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([k,l])=><label className="field" key={k}>{l}<input type="number" min="0" step="0.01" value={form[k]||"0"} onChange={e=>set(k,e.target.value)}/></label>)}
      {payment&&<label className="field">Daily disbursement — Amount<input type="number" min="0" step="0.01" value={form.dailyDisbursementAmount||"0"} onChange={e=>set("dailyDisbursementAmount",e.target.value)}/></label>}
      {payment&&<label className="field">Weekly disbursement — Amount<input type="number" min="0" step="0.01" value={form.weeklyDisbursementAmount||"0"} onChange={e=>set("weeklyDisbursementAmount",e.target.value)}/></label>}
      {payment&&<label className="field">Monthly disbursement — Amount<input type="number" min="0" step="0.01" value={form.monthlyDisbursementAmount||"0"} onChange={e=>set("monthlyDisbursementAmount",e.target.value)}/></label>}
      {payment&&<label className="field">Savings withdrawal — Amount<input type="number" min="0" step="0.01" value={form.savingsWithdrawalAmount||"0"} onChange={e=>set("savingsWithdrawalAmount",e.target.value)}/></label>}
    </div>
  </div>;
}

function WeekRows({week,items,staff}:{week:number;items:Row[];staff:Staff[]}){
  const receiptKeys=receipts.map(x=>x[0]), paymentKeys=payments.map(x=>x[0]);
  const totalR=items.reduce((s,r)=>s+receiptTotal(r),0), totalP=items.reduce((s,r)=>s+paymentTotal(r),0);
  const label=(r:Row)=>staff.find(s=>s.id===r.staffId)?`${staff.find(s=>s.id===r.staffId)?.firstName||""} ${staff.find(s=>s.id===r.staffId)?.lastName||""}`:"";
  return <>
    {items.map(r=><tr key={r.id} className="odd:bg-white even:bg-slate-50">
      <td className="border p-2">{new Date(r.entryDate).toLocaleDateString("en-NG",{day:"2-digit",month:"2-digit"})}</td>
      <td className="border p-2">{r.description||label(r)||"—"}</td>
      {receiptKeys.map(k=><td key={k} className="border p-2 text-right">{n(r[k])?money(r[k]):""}</td>)}
      <td className="border p-2 text-right font-black text-emerald-800">{money(receiptTotal(r))}</td>
      {paymentKeys.map(k=><td key={k} className="border p-2 text-right">{n(r[k])?money(r[k]):""}</td>)}
      <td className="border p-2 text-right font-black text-orange-700">{money(paymentTotal(r))}</td>
      <td className="border p-2 text-right font-black">{money(receiptTotal(r)-paymentTotal(r))}</td>
    </tr>)}
    <tr className="bg-slate-200 font-black">
      <td colSpan={2} className="border p-2">Weekly Total — Week {week}</td>
      {receipts.map(([k])=><td key={k} className="border p-2 text-right">{money(items.reduce((s,r)=>s+n(r[k]),0))}</td>)}
      <td className="border p-2 text-right">{money(totalR)}</td>
      {payments.map(([k])=><td key={k} className="border p-2 text-right">{money(items.reduce((s,r)=>s+n(r[k]),0))}</td>)}
      <td className="border p-2 text-right">{money(totalP)}</td>
      <td className="border p-2 text-right">{money(totalR-totalP)}</td>
    </tr>
  </>;
}
