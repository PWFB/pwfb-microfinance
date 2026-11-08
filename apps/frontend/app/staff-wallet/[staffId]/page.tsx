"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";

type Tx = { id:string; type:string; amount:number; previousBalance:number; newBalance:number; reference?:string|null; description?:string|null; createdAt?:string };
type Wallet = { id:string; staffId:string; branchId:string; balance:number; currency:string; firstName?:string; middleName?:string; lastName?:string; position?:string; branchName?:string; transactions:Tx[] };

const money=(v:any)=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:2}).format(Number(v)||0);

export default function StaffWalletDetailPage({params}:{params:Promise<{staffId:string}>}){
  const { staffId } = use(params);
  const [wallet,setWallet]=useState<Wallet|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{(async()=>{try{const d=await apiRequest(`/staff-wallet/${staffId}`);setWallet(d)}catch(e:any){setError(e?.message||"Unable to load staff wallet")}finally{setLoading(false)}})()},[staffId]);
  if(loading)return <main className="min-h-screen bg-slate-50 p-6"><p>Loading staff wallet…</p></main>;
  if(error||!wallet)return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-sm"><p className="font-bold text-red-700">{error||"Staff wallet not found."}</p><Link className="mt-4 inline-block rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white" href="/staff-wallet">Back to Staff Wallet</Link></div></main>;
  const name=[wallet.firstName,wallet.middleName,wallet.lastName].filter(Boolean).join(" ");
  return <main className="min-h-screen bg-slate-50 p-4 text-slate-800 md:p-7"><div className="mx-auto max-w-5xl">
    <header className="mb-6 rounded-3xl bg-gradient-to-r from-orange-600 to-emerald-700 p-6 text-white shadow-lg"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black tracking-[.2em] text-orange-100">FIELD CASH CONTROL</p><h1 className="text-3xl font-black">{name||"Staff Wallet"}</h1><p className="mt-1 text-sm">{wallet.position||"Staff"} • {wallet.branchName||"Branch"}</p></div><Link href="/staff-wallet" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-black">← All Staff Wallets</Link></div></header>
    <section className="mb-6 grid gap-4 md:grid-cols-3"><div className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase text-slate-500">Wallet balance</p><strong className="mt-2 block text-3xl font-black text-emerald-700">{money(wallet.balance)}</strong></div><div className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase text-slate-500">Staff</p><strong className="mt-2 block text-lg">{name||wallet.staffId}</strong></div><div className="rounded-3xl bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase text-slate-500">Wallet ID</p><strong className="mt-2 block break-all text-sm">{wallet.id}</strong></div></section>
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-black text-emerald-900">Wallet history</h2><p className="text-xs text-slate-500">Read-only history for now. The existing Issue/Settle input workflow remains on the main Staff Wallet page.</p></div><div className="overflow-x-auto"><table className="min-w-[850px] w-full text-sm"><thead className="bg-emerald-50 text-left text-xs uppercase text-emerald-900"><tr><th className="p-4">Date</th><th className="p-4">Type</th><th className="p-4">Amount</th><th className="p-4">Previous</th><th className="p-4">New balance</th><th className="p-4">Reference</th><th className="p-4">Description</th></tr></thead><tbody>{wallet.transactions?.length?wallet.transactions.map(tx=><tr key={tx.id} className="border-t"><td className="p-4">{tx.createdAt?new Date(tx.createdAt).toLocaleString("en-NG"):"—"}</td><td className="p-4 font-bold">{tx.type}</td><td className="p-4 font-black">{money(tx.amount)}</td><td className="p-4">{money(tx.previousBalance)}</td><td className="p-4 font-black text-emerald-700">{money(tx.newBalance)}</td><td className="p-4">{tx.reference||"—"}</td><td className="p-4">{tx.description||"—"}</td></tr>):<tr><td colSpan={7} className="p-6 text-center text-slate-500">No wallet movements yet.</td></tr>}</tbody></table></div></section>
  </div></main>;
}
