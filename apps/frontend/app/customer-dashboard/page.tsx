"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pwfbApi } from "../../lib/pwfb-api";

type Customer = { id: string; firstName?: string; lastName?: string; savings?: any[]; loans?: any[] };
type Wallet = { balance?: number; currency?: string };
type Transaction = { id: string; type?: string; amount?: number; description?: string; status?: string; createdAt?: string; created_at?: string };
const navigation = [
  { href: "/customer-dashboard", label: "Home", icon: "⌂" }, { href: "/customer-wallet", label: "Wallet", icon: "₦" },
  { href: "/customer-deposit", label: "Deposit", icon: "↓" }, { href: "/customer-withdraw", label: "Withdraw", icon: "↑" },
  { href: "/customer-transfer", label: "Transfer", icon: "↔" }, { href: "/customer-savings", label: "Savings", icon: "💰" },
  { href: "/customer-loans", label: "Loans", icon: "▣" }, { href: "/customer-transactions", label: "Transactions", icon: "≡" },
  { href: "/customer-more", label: "More", icon: "•••" },
];

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null), [wallet, setWallet] = useState<Wallet | null>(null), [transactions, setTransactions] = useState<Transaction[]>([]), [loading, setLoading] = useState(true), [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => { async function loadDashboard() { try { setLoading(true); const profile = await pwfbApi.customers.me(); setCustomer(profile); if (profile?.id) { const [customerWallet, customerTransactions] = await Promise.all([pwfbApi.banking.customerWallet(profile.id), pwfbApi.banking.customerTransactions(profile.id)]); setWallet(customerWallet); setTransactions(Array.isArray(customerTransactions) ? customerTransactions : customerTransactions?.data ?? []); } } catch (error) { console.error("Customer dashboard failed:", error); } finally { setLoading(false); } } loadDashboard(); }, []);
  const money = (value: number) => `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (value?: string) => { if (!value) return ""; const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }); };
  const savingsBalance = customer?.savings?.reduce((total, item) => total + Number(item.balance ?? item.amount ?? item.currentBalance ?? 0), 0) || 0;
  const borrowedLoan = customer?.loans?.reduce((total, loan) => total + Number(loan.amount ?? loan.principalAmount ?? loan.loanAmount ?? 0), 0) || 0;
  const loanBalance = customer?.loans?.reduce((total, loan) => total + Number(loan.outstandingBalance ?? loan.balance ?? loan.remainingBalance ?? 0), 0) || 0;
  const displayName = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "Customer";
  if (loading) return <main className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-emerald-700">Loading your wallet...</p></main>;

  return <main className="min-h-screen bg-slate-50 pb-24 lg:pb-0">
    <div className="flex min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-emerald-100 bg-white shadow-lg transition-all duration-300 ${sidebarOpen ? "w-64" : "w-[76px]"}`}>
        <div className="flex h-20 items-center border-b border-emerald-100 px-3">
          <div className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${sidebarOpen ? "w-full opacity-100" : "w-0 opacity-0"}`}><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">PWFB</p><h2 className="mt-1 text-xl font-bold text-slate-900">My Wallet</h2></div>
          <button type="button" onClick={() => setSidebarOpen(v => !v)} aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl font-bold text-emerald-700 hover:bg-emerald-100">{sidebarOpen ? "‹" : "›"}</button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Customer navigation">
          {navigation.map(item => { const active = item.href === "/customer-dashboard"; return <Link key={item.href} href={item.href} title={!sidebarOpen ? item.label : undefined} className={`flex items-center rounded-xl py-3 transition ${sidebarOpen ? "gap-3 px-3" : "justify-center px-2"} ${active ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-sm text-emerald-700">{item.icon}</span><span className={`overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300 ${sidebarOpen ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"}`}>{item.label}</span></Link>; })}
        </nav>
        <div className={`border-t border-emerald-100 p-3 transition-all duration-300 ${sidebarOpen ? "opacity-100" : "opacity-0"}`}><p className="text-xs font-medium text-slate-500">Available Balance</p><p className="mt-1 text-lg font-bold text-emerald-700">{money(Number(wallet?.balance || 0))}</p></div>
      </aside>

      <div className={`min-w-0 flex-1 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "lg:ml-[76px]"}`}>
        <header className="sticky top-0 z-40 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle customer sidebar" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl text-slate-700 shadow-sm">☰</button>
          <div className="ml-3"><p className="text-xs font-semibold text-emerald-600">PWFB CUSTOMER</p><p className="text-sm font-bold text-slate-900">{displayName}</p></div>
        </header>
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-6"><p className="text-sm text-slate-500">Welcome back</p><h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{displayName}</h1></div>
          <section className="grid grid-cols-2 gap-4"><div className="min-h-32 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm"><p className="text-sm font-medium text-emerald-700">Available Balance</p><p className="mt-4 text-2xl font-bold text-emerald-800">{money(Number(wallet?.balance || 0))}</p></div><div className="min-h-32 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Savings Balance</p><p className="mt-4 text-2xl font-bold text-slate-900">{money(savingsBalance)}</p></div><div className="min-h-32 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Borrowed Loan</p><p className="mt-4 text-2xl font-bold text-slate-900">{money(borrowedLoan)}</p></div><div className="min-h-32 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Loan Balance</p><p className="mt-4 text-2xl font-bold text-slate-900">{money(loanBalance)}</p></div></section>
          <section className="mt-6"><h2 className="mb-3 text-lg font-bold text-slate-900">Quick Actions</h2><div className="grid grid-cols-3 gap-3"><Link href="/customer-deposit" className="rounded-xl bg-emerald-600 p-4 text-center text-white shadow-sm"><span className="block text-xl">₦</span><span className="mt-1 block text-xs font-semibold">Deposit</span></Link><Link href="/customer-withdraw" className="rounded-xl bg-orange-500 p-4 text-center text-white shadow-sm"><span className="block text-xl">↗</span><span className="mt-1 block text-xs font-semibold">Withdrawal</span></Link><Link href="/customer-transfer" className="rounded-xl border border-slate-200 bg-white p-4 text-center text-slate-800 shadow-sm"><span className="block text-xl">↔</span><span className="mt-1 block text-xs font-semibold">Transfer</span></Link></div></section>
          <section className="mt-6 rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-semibold text-slate-900">Recent Transactions</h2><p className="text-xs text-slate-500">Your latest wallet activity</p></div><Link href="/customer-transactions" className="text-sm font-semibold text-emerald-600">History →</Link></div>{transactions.length === 0 ? <div className="p-6 text-center"><div className="text-2xl">₦</div><p className="mt-2 font-medium text-slate-700">No transactions yet</p><p className="mt-1 text-sm text-slate-500">Your wallet activity will appear here.</p></div> : <div>{transactions.slice(0, 5).map(t => <div key={t.id} className="flex items-center justify-between border-b border-slate-100 p-4 last:border-b-0"><div className="min-w-0"><p className="truncate font-medium text-slate-800">{t.description || t.type || "Transaction"}</p><p className="text-xs text-slate-500">{formatDate(t.createdAt || t.created_at)}</p></div><p className="ml-4 font-semibold text-slate-900">{money(Number(t.amount || 0))}</p></div>)}</div>}</section>
        </div>
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white lg:hidden"><div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2"><Link href="/customer-dashboard" className="flex flex-col items-center px-2 py-1 text-emerald-600"><span className="text-lg">⌂</span><span className="text-[10px] font-semibold">Home</span></Link><Link href="/customer-wallet" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">₦</span><span className="text-[10px]">Wallet</span></Link><Link href="/customer-savings" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">💰</span><span className="text-[10px]">Saving</span></Link><Link href="/customer-loans" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">▣</span><span className="text-[10px]">Loan</span></Link><button type="button" onClick={() => router.push("/customer-more")} className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">•••</span><span className="text-[10px]">More</span></button></div></nav>
      </div>
    </div>
  </main>;
}
