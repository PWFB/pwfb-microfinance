"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import styles from "./cashbook.module.css";

type Branch={id:string;name:string};
type Period={id:string;name:string;status?:string};
type Staff={id:string;staffId?:string;firstName?:string;lastName?:string;position?:string;branchId?:string};
type Row={id:string;entryDate:string;description?:string;referenceNo?:string;staffId?:string;staff?:{staffId?:string;firstName?:string;lastName?:string}|null;branch?:{name?:string};[key:string]:any};
type PostedEntry={id:string;entryDate:string;type:'CASH_IN'|'CASH_OUT';amount:number;reference?:string|null;description?:string|null;staffId?:string|null;staff?:{staffId?:string;firstName?:string;lastName?:string}|null};

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

const paymentColumns=[
  ["dailyDisbursementCount","Daily Loan","No"],
  ["dailyDisbursementAmount","Daily Loan","N"],
  ["weeklyDisbursementCount","Weekly Loan","No"],
  ["weeklyDisbursementAmount","Weekly Loan","N"],
  ["monthlyDisbursementCount","Monthly Loan","No"],
  ["monthlyDisbursementAmount","Monthly Loan","N"],
  ["bankDeposit","Bank Deposit",""],
  ["savingsWithdrawalCount","Saving Withdrawal","No"],
  ["savingsWithdrawalAmount","Saving Withdrawal","N"],
  ["savingsReturnedD","Savings returned / adjustment","D"],
  ["savingsReturnedW","Savings returned / adjustment","W"],
  ["savingsReturnedCash","Savings returned / adjustment","Cash"],
  ["savingsReturnedAdjust","Savings returned / adjustment","Adjust"],
  ["fundTransferHeadOffice","Fund transfer to","Head office"],
  ["fundTransferBranch","Fund transfer to","Branch office"],
  ["others","Other",""],
] as const;

const inputPaymentFields=[
  ["dailyDisbursementCount","Daily loan — No."],["dailyDisbursementAmount","Daily loan — Amount"],
  ["weeklyDisbursementCount","Weekly loan — No."],["weeklyDisbursementAmount","Weekly loan — Amount"],
  ["monthlyDisbursementCount","Monthly loan — No."],["monthlyDisbursementAmount","Monthly loan — Amount"],
  ["bankDeposit","Bank deposit"],
  ["savingsWithdrawalCount","Savings withdrawal — No."],["savingsWithdrawalAmount","Savings withdrawal — Amount"],
  ["savingsReturnedD","Savings returned — D"],["savingsReturnedW","Savings returned — W"],
  ["savingsReturnedCash","Savings returned — Cash"],["savingsReturnedAdjust","Savings returned — Adjust"],
  ["fundTransferHeadOffice","Fund transfer to Head Office"],["fundTransferBranch","Fund transfer to Branch"],["others","Other"],
] as const;

const moneyFields=[
  "previousCashAtHand","savingsDeposits","dailyCollection","weeklyCollection","monthlyCollection",
  "monitorRegistrationFees","riskPremium","passbookSales","loanApplicationForm","withdrawalFromBank",
  "fundReceivedHeadOffice","fundReceivedBranchOther","receiptOthers","dailyDisbursementAmount",
  "weeklyDisbursementAmount","monthlyDisbursementAmount","bankDeposit","savingsWithdrawalAmount",
  "savingsReturnedD","savingsReturnedW","savingsReturnedCash","savingsReturnedAdjust",
  "fundTransferHeadOffice","fundTransferBranch","others","otherAfterTotal"
];

const all=[...new Set([...receipts.map(x=>x[0]),...inputPaymentFields.map(x=>x[0]),...moneyFields])];
const blank=()=>{const x:any={entryDate:new Date().toISOString().slice(0,10),description:"",referenceNo:"",staffId:""};for(const k of all)x[k]="0";return x;};
const n=(v:any)=>Math.max(0,Number(v)||0);
const money=(v:any)=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(Number(v)||0);

function receiptTotal(r:any){return receipts.reduce((s,[k])=>s+n(r[k]),0);}
function paymentTotal(r:any){
  return ["dailyDisbursementAmount","weeklyDisbursementAmount","monthlyDisbursementAmount","bankDeposit","savingsWithdrawalAmount","savingsReturnedD","savingsReturnedW","savingsReturnedCash","savingsReturnedAdjust","fundTransferHeadOffice","fundTransferBranch","others"].reduce((s,k)=>s+n(r[k]),0);
}
function weekOfMonth(dateValue:string){return Math.floor((new Date(dateValue).getDate()-1)/7)+1;}

export default function CashbookPage(){
  const [branches,setBranches]=useState<Branch[]>([]);
  const [periods,setPeriods]=useState<Period[]>([]);
  const [staff,setStaff]=useState<Staff[]>([]);
  const [branchId,setBranchId]=useState("");
  const [periodId,setPeriodId]=useState("");
  const [form,setForm]=useState<any>(blank());
  const [rows,setRows]=useState<Row[]>([]);
  const [postedEntries,setPostedEntries]=useState<PostedEntry[]>([]);
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
      const bs=Array.isArray(b)?b:[],ps=Array.isArray(p)?p:[];
      setBranches(bs);setPeriods(ps);
      if(bs[0])setBranchId(bs[0].id);
      const open=ps.find((x:Period)=>x.status==="OPEN")||ps[0];
      if(open)setPeriodId(open.id);
    }catch(e:any){setError(e?.message||"Unable to load cashbook settings");}
  }
  async function loadStaff(){try{const s=await apiRequest("/staff");const list=Array.isArray(s)?s:[];setStaff(list);if(list.length===1)setForm((current:any)=>({...current,staffId:list[0].id}));}catch{setStaff([]);}}
  async function load(){
    if(!periodId||!branchId)return;
    try{
      setLoading(true);
      const q=new URLSearchParams({periodId,branchId});
      if(from)q.set("from",from);if(to)q.set("to",`${to}T23:59:59`);
      const [d,posted]=await Promise.all([
        apiRequest(`/cashbook/daily?${q}`),
        apiRequest(`/cashbook?${q}`),
      ]);
      setRows(Array.isArray(d)?d:[]);
      setPostedEntries(Array.isArray(posted)?posted:[]);
    }catch(e:any){setError(e?.message||"Unable to load cashbook");}finally{setLoading(false);}
  }
  async function loadOpeningBalance(){
    if(!branchId)return;
    try{
      const q=new URLSearchParams({branchId,entryDate:form.entryDate});
      if(form.staffId)q.set("staffId",form.staffId);
      const value=await apiRequest(`/cashbook/daily/opening-balance?${q}`);
      setForm((current:any)=>({...current,previousCashAtHand:String(Number(value?.previousCashAtHand||0))}));
    }catch(e:any){
      setError(e?.message||"Unable to calculate the previous closing cash balance.");
    }
  }
  useEffect(()=>{void init();void loadStaff();},[]);
  useEffect(()=>{void load();},[periodId,branchId,from,to]);
  useEffect(()=>{void loadOpeningBalance();},[branchId,form.staffId,form.entryDate]);

  async function submit(e:React.FormEvent){
    e.preventDefault();setError("");setMessage("");
    if(!periodId||!branchId)return setError("Select a financial period and branch.");
    if(receiptTotal(form)<=0&&paymentTotal(form)<=0)return setError("Enter at least one cashbook amount.");
    setSaving(true);
    try{
      const body:any={periodId,branchId,entryDate:form.entryDate,description:form.description,referenceNo:form.referenceNo,staffId:form.staffId||undefined};
      for(const k of all)body[k]=n(form[k]);
      await apiRequest("/cashbook/daily",{method:"POST",body:JSON.stringify(body)});
      setMessage("✓ Cashbook row posted successfully.");setForm(blank());await load();
    }catch(e:any){setError(e?.message||"Unable to post cashbook row");}finally{setSaving(false);}
  }

  const weekly=useMemo(()=>{
    const groups=new Map<number,Row[]>();
    for(const r of rows){const w=weekOfMonth(r.entryDate);if(!groups.has(w))groups.set(w,[]);groups.get(w)!.push(r);}
    return Array.from(groups.entries()).sort((a,b)=>a[0]-b[0]);
  },[rows]);
  const monthReceipts=rows.reduce((s,r)=>s+receiptTotal(r),0);
  const monthPayments=rows.reduce((s,r)=>s+paymentTotal(r),0);
  const monthOther=rows.reduce((s,r)=>s+n(r.otherAfterTotal),0);

  return <main className={`min-h-screen bg-slate-100 p-3 text-slate-900 md:p-6 ${styles.cashbookPage}`}>
    <div className="mx-auto max-w-[1900px]">
      <header className="mb-4 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-black text-emerald-950">Cash Book</h1><p className="text-sm text-slate-600">Finance Services · physical PWFB cashbook layout.</p></div>
          <div className="flex gap-2"><Link href="/dashboard" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white">Dashboard</Link><Link href="/staff-wallet" className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-white">Staff Wallet</Link></div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="field">Cash Book for the Month<select value={periodId} onChange={e=>setPeriodId(e.target.value)}>{periods.map(p=><option key={p.id} value={p.id}>{p.name}{p.status==="CLOSED"?" — CLOSED":""}</option>)}</select></label>
          <label className="field">Branch<select value={branchId} onChange={e=>{setBranchId(e.target.value);set("staffId","")}}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label className="field">From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
          <label className="field">To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
        </div>
      </header>
      {error&&<div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
      {message&&<div className={`mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-bold text-emerald-900 ${styles.cashbookSuccess}`}>{message}</div>}

      <section className="mb-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-emerald-950 p-4 text-white"><h2 className="font-black">New Daily Cash Book Entry</h2><p className="text-xs text-emerald-100">Opening cash is carried forward automatically from the previous closing balance. All other daily fields start fresh.</p></div>
        <form onSubmit={submit} className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="field">Date<input type="date" value={form.entryDate} onChange={e=>set("entryDate",e.target.value)}/></label>
            <label className="field">Description<input value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Customer / daily description"/></label>
            <label className="field">Field staff / collector<select value={form.staffId} onChange={e=>set("staffId",e.target.value)}><option value="">Not assigned</option>{staff.filter(s=>!s.branchId||s.branchId===branchId).map(s=><option key={s.id} value={s.id}>{s.staffId||s.id} · {s.firstName} {s.lastName} — {s.position||"Staff"}</option>)}</select></label>
            <label className="field">Reference<input value={form.referenceNo} onChange={e=>set("referenceNo",e.target.value)} placeholder="Voucher / reference"/></label>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <InputGroup title="Receipts / Debit" items={receipts} form={form} set={set}/>
            <InputGroup title="Payments / Credit" items={inputPaymentFields} form={form} set={set} payment/>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
            <div className="text-sm"><b>Receipt total:</b> {money(receiptTotal(form))}<span className="mx-3"><b>Payment total:</b> {money(paymentTotal(form))}</span><b>Balance:</b> {money(receiptTotal(form)-paymentTotal(form))}</div>
            <button disabled={saving} className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{saving?"Posting…":"Post Daily Row"}</button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-emerald-950">Cash Book for the Month</h2><p className="text-xs text-slate-500">Weekly Total and Monthly Total are shown like the physical summary sheet.</p></div><div className="text-sm font-bold">Receipts {money(monthReceipts)} · Payments {money(monthPayments)} · Other {money(monthOther)} · Final {money(monthReceipts-monthPayments+monthOther)}</div></div></div>
        <div className="overflow-x-auto">
          <div className="min-w-[2500px]">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-emerald-950 text-white">
                  <th colSpan={16} className="border p-2 text-left text-sm">Receipts / Debit</th>
                  <th colSpan={21} className="border p-2 text-left text-sm">Payments / Credit</th>
                </tr>
                <tr className="bg-emerald-50 text-emerald-950">
                  <th rowSpan={2} className="border p-2">Date</th><th rowSpan={2} className="border p-2 min-w-[160px]">Description / Field Officer</th>
                  {receipts.map(([k,l])=><th rowSpan={2} key={k} className="border p-2 min-w-[95px]">{l}</th>)}
                  <th rowSpan={2} className="border p-2 min-w-[105px]">Total</th>
                  <th rowSpan={2} className="border p-2">Date</th><th rowSpan={2} className="border p-2 min-w-[120px]">Description</th>
                  <th colSpan={2} className="border p-2">Daily Loan</th><th colSpan={2} className="border p-2">Weekly Loan</th><th colSpan={2} className="border p-2">Monthly Loan</th>
                  <th rowSpan={2} className="border p-2">Bank Deposit</th><th colSpan={2} className="border p-2">Saving Withdrawal</th><th colSpan={4} className="border p-2">Savings returned / adjustment</th><th colSpan={2} className="border p-2">Fund transfer to</th><th rowSpan={2} className="border p-2">Other</th><th rowSpan={2} className="border p-2">Total</th><th rowSpan={2} className="border p-2">Other</th><th rowSpan={2} className="border p-2">Total</th>
                </tr>
                <tr className="bg-slate-100 text-[9px] font-black">
                  {["No","N","No","N","No","N"].map((x,i)=><th key={i} className="border p-1">{x}</th>)}
                  {["No","N","D","W","Cash","Adjust","Head office","Branch office"].map((x,i)=><th key={i} className="border p-1">{x}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading?<tr><td colSpan={37} className="border p-8 text-center">Loading…</td></tr>:
                  weekly.length===0?<tr><td colSpan={37} className="border p-8 text-center text-slate-500">No cashbook entries for this period.</td></tr>:
                  weekly.map(([week,items])=><WeekRows key={week} week={week} items={items}/>)
                }
              </tbody>
              <tfoot>
                <tr className="bg-emerald-900 font-black text-white">
                  <td colSpan={2} className="border p-2">Monthly Total</td>
                  {receipts.map(([k])=><td key={k} className="border p-2 text-right">{money(rows.reduce((s,r)=>s+n(r[k]),0))}</td>)}
                  <td className="border p-2 text-right">{money(monthReceipts)}</td>
                  <td colSpan={2} className="border p-2">Monthly Total</td>
                  {paymentColumns.map(([k,,sub])=><td key={k} className="border p-2 text-right">{sub==="No"?String(Math.round(rows.reduce((s,r)=>s+n(r[k]),0))):money(rows.reduce((s,r)=>s+n(r[k]),0))}</td>)}
                  <td className="border p-2 text-right">{money(monthPayments)}</td><td className="border p-2 text-right">{money(monthOther)}</td><td className="border p-2 text-right">{money(monthPayments+monthOther)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div className="border-t p-4 text-xs font-bold text-slate-500">BM Register · BM (Name/Sign.) · Horizontal scrolling is intentional on phone so the complete 37-column register remains readable.</div>
      </section>
      <section className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-4">
          <h2 className="text-lg font-black text-emerald-950">Posted Branch Cashbook Entries</h2>
          <p className="text-xs text-slate-500">Receipts and payments posted by the banking, collection and finance workflows. Cash deposits display the collecting Staff ID; this list is separate from the physical daily register to avoid double counting.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[850px] w-full border-collapse text-sm">
            <thead className="bg-emerald-950 text-left text-xs uppercase text-white">
              <tr><th className="p-3">Date</th><th className="p-3">Branch / Staff ID</th><th className="p-3">Reference</th><th className="p-3">Description</th><th className="p-3">Type</th><th className="p-3 text-right">Amount</th></tr>
            </thead>
            <tbody>
              {postedEntries.length===0?<tr><td colSpan={6} className="p-6 text-center text-slate-500">No posted cashbook entries for this branch and period.</td></tr>:postedEntries.map(entry=><tr key={entry.id} className="border-t">
                <td className="p-3">{new Date(entry.entryDate).toLocaleString("en-NG")}</td>
                <td className="p-3"><strong>{entry.staff?.staffId||entry.staffId||"Branch entry"}</strong><small className="block text-slate-500">{[entry.staff?.firstName,entry.staff?.lastName].filter(Boolean).join(" ")}</small></td>
                <td className="p-3">{entry.reference||"—"}</td><td className="p-3">{entry.description||"—"}</td>
                <td className="p-3">{entry.type==="CASH_IN"?"Cash received":"Cash paid"}</td>
                <td className="p-3 text-right font-black">{money(Number(entry.amount||0))}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </main>;
}

function InputGroup({title,items,form,set,payment=false}:{title:string;items:readonly (readonly [string,string])[];form:any;set:(k:string,v:string)=>void;payment?:boolean}){
  return <div className={`rounded-xl border ${payment?"border-orange-300":"border-emerald-300"}`}>
    <div className={`border-b p-3 font-black ${payment?"bg-orange-100 text-orange-950":"bg-emerald-100 text-emerald-950"}`}>{title}</div>
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(112px,0.8fr)] gap-3 border-b bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-800">
      <span>Cashbook item</span><span className="text-right">Amount (₦)</span>
    </div>
    <div className="divide-y divide-slate-200">
      {items.map(([k,l])=><div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(112px,0.8fr)] items-center gap-3 px-3 py-2">
        <label htmlFor={`cashbook-${k}`} className="text-sm font-bold text-slate-900">{l}</label>
        <input id={`cashbook-${k}`} className={styles.cashbookAmountInput} aria-label={`${l} amount in naira`} type="number" min="0" step="0.01" inputMode="decimal" value={form[k]||"0"} readOnly={k==="previousCashAtHand"} aria-readonly={k==="previousCashAtHand"} title={k==="previousCashAtHand"?"Calculated automatically from the previous daily closing balance":undefined} onChange={k==="previousCashAtHand"?undefined:e=>set(k,e.target.value)}/>
      </div>)}
    </div>
  </div>;
}

function WeekRows({week,items}:{week:number;items:Row[]}){
  const totalR=items.reduce((s,r)=>s+receiptTotal(r),0),totalP=items.reduce((s,r)=>s+paymentTotal(r),0),other=items.reduce((s,r)=>s+n(r.otherAfterTotal),0);
  const staffName=(r:Row)=>r.narration||"";
  return <>
    {items.map(r=><tr key={r.id} className="odd:bg-white even:bg-slate-50">
      <td className="border p-2">{new Date(r.entryDate).toLocaleDateString("en-NG",{day:"2-digit",month:"2-digit"})}</td>
      <td className="border p-2">
        {r.staff&&<div className="mb-1"><strong className="block text-emerald-900">{r.staff.staffId||r.staffId||"Staff ID unavailable"}</strong><small className="text-slate-500">{[r.staff.firstName,r.staff.lastName].filter(Boolean).join(" ")}</small></div>}
        <span>{r.description||"—"}</span>
      </td>
      {receipts.map(([k])=><td key={k} className="border p-2 text-right">{n(r[k])?money(r[k]):""}</td>)}
      <td className="border p-2 text-right font-black text-emerald-800">{money(receiptTotal(r))}</td>
      <td className="border p-2">{new Date(r.entryDate).toLocaleDateString("en-NG",{day:"2-digit",month:"2-digit"})}</td>
      <td className="border p-2">{staffName(r)||"—"}</td>
      {paymentColumns.map(([k,,sub])=><td key={k} className="border p-2 text-right">{n(r[k])?(sub==="No"?String(Math.round(n(r[k]))):money(r[k])):""}</td>)}
      <td className="border p-2 text-right font-black text-orange-700">{money(paymentTotal(r))}</td>
      <td className="border p-2 text-right">{money(r.otherAfterTotal)}</td>
      <td className="border p-2 text-right font-black">{money(paymentTotal(r)+n(r.otherAfterTotal))}</td>
    </tr>)}
    <tr className="bg-slate-200 font-black">
      <td colSpan={2} className="border p-2">Weekly Total — Week {week}</td>
      {receipts.map(([k])=><td key={k} className="border p-2 text-right">{money(items.reduce((s,r)=>s+n(r[k]),0))}</td>)}
      <td className="border p-2 text-right">{money(totalR)}</td>
      <td colSpan={2} className="border p-2">Weekly Total</td>
      {paymentColumns.map(([k,,sub])=><td key={k} className="border p-2 text-right">{sub==="No"?String(Math.round(items.reduce((s,r)=>s+n(r[k]),0))):money(items.reduce((s,r)=>s+n(r[k]),0))}</td>)}
      <td className="border p-2 text-right">{money(totalP)}</td><td className="border p-2 text-right">{money(other)}</td><td className="border p-2 text-right">{money(totalP+other)}</td>
    </tr>
  </>;
}
