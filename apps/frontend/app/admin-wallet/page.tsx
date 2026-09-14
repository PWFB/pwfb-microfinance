"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";

type Wallet = { balance?: number; currency?: string; name?: string };
type Row = { id: string; type: string; amount: number; previousBalance: number; newBalance: number; reference: string; description?: string; createdAt: string };

export default function AdminWalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const [w, r] = await Promise.all([apiRequest("/super-admin/wallet"), apiRequest("/super-admin/wallet/transactions")]);
    setWallet(w); setRows(Array.isArray(r) ? r : []);
  }
  useEffect(() => { load().catch(e => setMessage(e instanceof Error ? e.message : "Unable to load Admin Wallet.")); }, []);

  async function recordCharge(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMessage("");
    try {
      await apiRequest("/super-admin/wallet/charges", { method: "POST", body: JSON.stringify({ amount: Number(amount), reference: reference.trim() || undefined, description: description.trim() || undefined }) });
      setAmount(""); setReference(""); setDescription(""); await load(); setMessage("Charge stored in the Super Admin Charges Wallet.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to store charge."); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-slate-50 p-5 text-slate-800 md:p-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-emerald-900 to-emerald-700 p-6 text-white shadow-lg">
        <div><p className="text-xs font-black tracking-[.2em] text-orange-300">PWFB SUPER ADMIN</p><h1 className="text-3xl font-black">Charges Wallet</h1><p className="mt-1 text-sm text-emerald-100">Dedicated account for storing PWFB administrative charges and fee income.</p></div>
        <Link href="/dashboard" className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-black">Dashboard</Link>
      </header>
      {message && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</div>}
      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-500">WALLET</p><h2 className="mt-2 text-xl font-black text-emerald-900">{wallet?.name || "Super Admin Charges Wallet"}</h2></div>
        <div className="rounded-2xl border-t-4 border-orange-500 bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-500">AVAILABLE BALANCE</p><strong className="mt-2 block text-3xl text-emerald-800">₦{Number(wallet?.balance || 0).toLocaleString()}</strong></div>
        <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-500">LEDGER ENTRIES</p><strong className="mt-2 block text-3xl text-emerald-900">{rows.length}</strong></div>
      </section>
      <section className="mb-5 rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-xs font-black tracking-widest text-orange-600">STORE CHARGE</p><h2 className="mb-4 text-xl font-black text-emerald-900">Record Administrative Charge</h2>
        <form onSubmit={recordCharge} className="grid gap-4 md:grid-cols-3">
          <label className="text-xs font-bold">Amount (₦)<input className="mt-1 w-full rounded-xl border p-3" type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required /></label>
          <label className="text-xs font-bold">Reference<input className="mt-1 w-full rounded-xl border p-3" value={reference} onChange={e=>setReference(e.target.value)} placeholder="Optional charge reference" /></label>
          <label className="text-xs font-bold">Description<input className="mt-1 w-full rounded-xl border p-3" value={description} onChange={e=>setDescription(e.target.value)} placeholder="e.g. transfer charge" /></label>
          <div className="md:col-span-3"><button disabled={loading} className="rounded-xl bg-orange-500 px-6 py-3 font-black text-white">{loading ? "Saving…" : "Store Charge"}</button></div>
        </form>
      </section>
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="border-b p-5"><p className="text-xs font-black tracking-widest text-orange-600">LEDGER</p><h2 className="text-xl font-black text-emerald-900">Charges History</h2></div><div className="overflow-x-auto"><table className="min-w-[800px] w-full text-sm"><thead className="bg-emerald-50 text-left text-xs uppercase text-emerald-900"><tr><th className="p-3">Date</th><th className="p-3">Reference</th><th className="p-3">Description</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Balance</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t"><td className="p-3">{new Date(r.createdAt).toLocaleString()}</td><td className="p-3">{r.reference}</td><td className="p-3">{r.description || "Charge"}</td><td className="p-3 text-right font-bold text-emerald-700">₦{Number(r.amount).toLocaleString()}</td><td className="p-3 text-right font-bold">₦{Number(r.newBalance).toLocaleString()}</td></tr>)}</tbody></table></div></section>
    </div>
  </main>;
}
