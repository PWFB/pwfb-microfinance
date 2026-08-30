"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

export default function CustomerAccountPage() {
  const { user, loading: authLoading } = useAuth();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        setLoading(true);
        const data = await pwfbApi.customers.me();
        setCustomer(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load your account.");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  if (authLoading || loading) return <main className="min-h-screen bg-slate-50 p-6"><p>Loading your account...</p></main>;
  if (!user) return <main className="min-h-screen bg-slate-50 p-6"><p>Please sign in first.</p><Link className="font-semibold text-emerald-700" href="/login">Login</Link></main>;

  const name = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "Customer";
  const email = user?.email || customer?.email || "—";
  const phone = customer?.phone || "—";

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <header className="bg-[#064d25] px-5 py-5 text-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div><p className="text-[10px] font-bold tracking-widest text-emerald-100">PWFB CUSTOMER</p><h1 className="mt-1 text-xl font-bold">My Account</h1></div>
          <Link href="/customer-wallet" className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20">Wallet</Link>
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-4 p-5">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold tracking-wide text-emerald-700">ACCOUNT PROFILE</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">{name}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Customer ID</p><p className="mt-1 break-all font-semibold text-slate-800">{customer?.id || "—"}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Email</p><p className="mt-1 break-all font-semibold text-slate-800">{email}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Phone</p><p className="mt-1 font-semibold text-slate-800">{phone}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Branch</p><p className="mt-1 break-all font-semibold text-slate-800">{customer?.branchId || "—"}</p></div>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold tracking-wide text-emerald-700">BANK TRANSFERS</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Send money to a bank account</h2>
          <p className="mt-1 text-sm text-slate-500">Select a bank, verify the destination account name, then transfer from your authenticated PWFB wallet.</p>
          <Link href="/customer-bank-transfer" className="mt-4 inline-flex rounded-xl bg-[#087534] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#075d2a]">Transfer to Bank</Link>
        </section>
        <section className="grid gap-3 sm:grid-cols-2">
          <Link href="/customer-wallet" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="font-bold text-slate-900">Wallet</p><p className="mt-1 text-xs text-slate-500">View balance and wallet activity.</p></Link>
          <Link href="/customer-transactions" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="font-bold text-slate-900">Transactions</p><p className="mt-1 text-xs text-slate-500">View your transaction history.</p></Link>
        </section>
      </div>
    </main>
  );
}
