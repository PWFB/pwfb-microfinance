"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import PWFBCompanyBrand from "../../components/PWFBCompanyBrand";
import { pwfbApi } from "../../lib/pwfb-api";

const navItems = [
  ["/customer-dashboard", "⌂", "Home"], ["/customer-wallet", "₦", "Wallet"],
  ["/banking?operation=deposit", "↓", "Deposit"], ["/banking?operation=withdraw", "↗", "Withdraw"],
  ["/customer-bank-transfer", "↔", "Bank Transfer"], ["/customer-transactions", "↔", "Transactions"],
  ["/customer-savings", "💰", "Savings"], ["/customer-loans", "▣", "Loans"], ["/customer-account", "◉", "Account"],
  ["/customer-more", "•••", "More"],
];

export default function CustomerAccountPage() {
  const { user, loading: authLoading } = useAuth();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try { setLoading(true); setError(""); setCustomer(await pwfbApi.customers.me()); }
      catch (e) { setError(e instanceof Error ? e.message : "Unable to load your account."); }
      finally { setLoading(false); }
    })();
  }, [authLoading, user]);

  if (authLoading || loading) return <main className="min-h-screen bg-slate-50 p-6"><p>Loading your account...</p></main>;
  if (!user) return <main className="min-h-screen bg-slate-50 p-6"><p>Please sign in first.</p><Link className="font-semibold text-emerald-700" href="/login">Login</Link></main>;

  const name = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "Customer";
  const email = user?.email || customer?.email || "—";
  const phone = customer?.phone || "—";

  return <main className="min-h-screen bg-slate-50 pb-10">
    <aside className={`fixed inset-y-0 left-0 z-[70] hidden lg:flex flex-col bg-[#064d25] text-white shadow-xl transition-all duration-300 ${sidebarOpen ? "w-52" : "w-[64px]"}`}>
      <div className={`flex h-16 items-center border-b border-white/10 ${sidebarOpen ? "px-3" : "justify-center px-2"}`}>
        <div className={sidebarOpen ? "block min-w-0 flex-1" : "hidden"}><PWFBCompanyBrand small /></div>
        <button type="button" onClick={() => setSidebarOpen(v => !v)} aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lg font-bold hover:bg-white/20">{sidebarOpen ? "‹" : "›"}</button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">{navItems.map(([href, icon, label]) => <Link key={href} href={href} title={!sidebarOpen ? label : undefined} className={`flex items-center rounded-lg py-2.5 transition ${sidebarOpen ? "gap-2 px-2" : "justify-center px-1"} ${href === "/customer-account" ? "bg-white/15 text-white" : "text-emerald-50/80 hover:bg-white/10 hover:text-white"}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-sm">{icon}</span><span className={`overflow-hidden whitespace-nowrap text-xs font-semibold transition-all ${sidebarOpen ? "max-w-[130px] opacity-100" : "max-w-0 opacity-0"}`}>{label}</span></Link>)}</nav>
      <div className={`border-t border-white/10 p-3 ${sidebarOpen ? "block" : "hidden"}`}><p className="text-[10px] text-emerald-100/70">Signed in account</p><p className="mt-1 truncate text-sm font-bold">{name}</p></div>
    </aside>

    <div className={`min-w-0 transition-all duration-300 ${sidebarOpen ? "lg:ml-52" : "lg:ml-[64px]"}`}>
      <header className="sticky top-0 z-40 flex h-14 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
        <button type="button" onClick={() => setSidebarOpen(v => !v)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg text-slate-700 shadow-sm" aria-label="Toggle sidebar">☰</button>
        <div className="ml-3"><p className="text-[10px] font-semibold text-emerald-700">PWFB CUSTOMER</p><p className="text-sm font-bold text-slate-900">{name}</p></div>
      </header>
      <div className="mx-auto max-w-3xl space-y-4 p-5">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><p className="text-xs font-bold tracking-wide text-emerald-700">ACCOUNT PROFILE</p><h2 className="mt-1 text-2xl font-bold text-slate-900">{name}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Customer ID</p><p className="mt-1 break-all font-semibold text-slate-800">{customer?.id || "—"}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Email</p><p className="mt-1 break-all font-semibold text-slate-800">{email}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Phone</p><p className="mt-1 font-semibold text-slate-800">{phone}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Branch</p><p className="mt-1 break-all font-semibold text-slate-800">{customer?.branchId || "—"}</p></div></div></section>
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><p className="text-xs font-bold tracking-wide text-emerald-700">BANK TRANSFERS</p><h2 className="mt-1 text-lg font-bold text-slate-900">Send money to a bank account</h2><p className="mt-1 text-sm text-slate-500">Select a bank, verify the destination account name, then transfer from your authenticated PWFB wallet.</p><Link href="/customer-bank-transfer" className="mt-4 inline-flex rounded-xl bg-[#087534] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#075d2a]">Transfer to Bank</Link></section>
        <section className="grid gap-3 sm:grid-cols-2"><Link href="/customer-wallet" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="font-bold text-slate-900">Wallet</p><p className="mt-1 text-xs text-slate-500">View balance and wallet activity.</p></Link><Link href="/customer-transactions" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="font-bold text-slate-900">Transactions</p><p className="mt-1 text-xs text-slate-500">View your transaction history.</p></Link></section>
      </div>
    </div>
  </main>;
}
