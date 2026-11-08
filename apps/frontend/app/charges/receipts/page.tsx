"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../lib/api";

type Receipt = { id: string; customerId: string; firstName?: string; lastName?: string; staffId: string; employeeStaffId?: string; staffFirstName?: string; staffLastName?: string; branchName?: string; amount: number; currency: string; paymentMethod: string; reference: string; cashbookEntryId: string; collectedAt: string };
const money=(v:number,currency="NGN")=>new Intl.NumberFormat("en-NG",{style:"currency",currency,maximumFractionDigits:2}).format(Number(v)||0);

export default function RegistrationReceiptsPage(){
 const [rows,setRows]=useState<Receipt[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[query,setQuery]=useState("");
 useEffect(()=>{apiRequest("/charges/registration-receipts").then(d=>setRows(Array.isArray(d)?d:[])).catch((e:any)=>setError(e?.message||"Unable to load registration fee receipts for your scope.")).finally(()=>setLoading(false));},[]);
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return rows.filter(r=>!q||[r.reference,r.customerId,r.firstName,r.lastName,r.employeeStaffId,r.staffFirstName,r.staffLastName,r.branchName,r.cashbookEntryId].filter(Boolean).join(" ").toLowerCase().includes(q));},[rows,query]);
 return <main className="min-h-screen bg-slate-50 p-4 text-slate-800 md:p-8"><div className="mx-auto max-w-7xl space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-emerald-900 p-6 text-white"><div><p className="text-xs font-black tracking-widest text-orange-300">BRANCH / OFFICER SCOPE</p><h1 className="mt-2 text-3xl font-black">Registration Fee Receipts</h1><p className="mt-1 text-sm text-emerald-100">Immutable receipt history with linked cashbook entry and registering Staff ID.</p></div><Link href="/customers" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold">Customers</Link></header>
  {error&&<div className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Collected registration fees</h2><p className="text-xs text-slate-500">{filtered.length} receipts in your authorized scope</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search reference, customer, Staff ID…" className="w-full max-w-sm rounded-xl border border-slate-300 px-4 py-2 text-sm"/></div>
   <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="p-3">Collected</th><th className="p-3">Customer</th><th className="p-3">Credit officer</th><th className="p-3">Branch</th><th className="p-3">Amount</th><th className="p-3">Receipt</th><th className="p-3">Cashbook entry</th></tr></thead><tbody>
    {filtered.map(r=><tr key={r.id} className="border-t border-slate-100"><td className="p-3">{new Date(r.collectedAt).toLocaleString("en-NG")}</td><td className="p-3">{r.firstName||""} {r.lastName||""}<small className="block text-slate-500">{r.customerId}</small></td><td className="p-3">{r.staffFirstName||""} {r.staffLastName||""}<small className="block text-slate-500">{r.employeeStaffId||r.staffId}</small></td><td className="p-3">{r.branchName||"—"}</td><td className="p-3 font-bold">{money(r.amount,r.currency)}</td><td className="p-3">{r.reference}<small className="block text-slate-500">{r.paymentMethod}</small></td><td className="p-3">{r.cashbookEntryId}</td></tr>)}
    {!loading&&filtered.length===0&&<tr><td className="p-4 text-center text-slate-500" colSpan={7}>No registration fee receipts in this scope.</td></tr>}
    {loading&&<tr><td className="p-4 text-center text-slate-500" colSpan={7}>Loading receipts…</td></tr>}
   </tbody></table></div>
  </section>
 </div></main>;
}
