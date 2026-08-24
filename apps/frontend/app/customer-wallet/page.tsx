"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Customer = { id: string; firstName?: string; lastName?: string; branchId?: string };
type Wallet = { balance?: number; currency?: string };
type VirtualAccount = { id: string; branchId?: string | null; institutionId?: string | null; institutionName?: string | null; institutionShortName?: string | null; accountNumber?: string | null; accountName?: string | null; provider?: string | null; status?: "PENDING" | "ACTIVE" | "FAILED" | "INACTIVE"; requestedAt?: string; assignedAt?: string | null; failureReason?: string | null };
type Transaction = { id: string; type?: string; amount?: number; description?: string; status?: string; createdAt?: string; created_at?: string };

type NavItem = { href: string; icon: string; label: string };
const navItems: NavItem[] = [
  { href: "/customer-dashboard", icon: "⌂", label: "Home" },
  { href: "/customer-wallet", icon: "₦", label: "Wallet" },
  { href: "/banking?operation=deposit", icon: "↓", label: "Deposit" },
  { href: "/banking?operation=withdraw", icon: "↗", label: "Withdraw" },
  { href: "/customer-transactions", icon: "↔", label: "Transactions" },
  { href: "/customer-savings", icon: "💰", label: "Savings" },
  { href: "/customer-loans", icon: "▣", label: "Loans" },
  { href: "/customer-more", icon: "•••", label: "More" },
];

export default function CustomerWalletPage() {
  const { user, loading: authLoading } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    async function loadWallet() {
      try {
        setLoading(true);
        setError("");
        const customerData = await pwfbApi.customers.me();
        setCustomer(customerData);
        const [walletData, transactionData, virtualAccounts] = await Promise.all([
          pwfbApi.banking.customerWallet(customerData.id),
          pwfbApi.banking.customerTransactions(customerData.id),
          pwfbApi.banking.customerVirtualAccounts(customerData.id),
        ]);
        setWallet(walletData);
        const list = Array.isArray(transactionData) ? transactionData : transactionData?.data ?? [];
        setTransactions(list);
        const accounts = Array.isArray(virtualAccounts) ? virtualAccounts : virtualAccounts?.data ?? [];
        setVirtualAccount(accounts[0] ?? null);
        if (accounts.length === 0) {
          setAccountLoading(true);
          const requested = await pwfbApi.banking.ensureCustomerVirtualAccount(customerData.id);
          const requestedList = Array.isArray(requested) ? requested : requested?.data ?? [];
          setVirtualAccount(requestedList[0] ?? null);
        }
      } catch (err) {
        console.error("Customer wallet load failed:", err);
        setError(err instanceof Error ? err.message : "Unable to load your wallet.");
      } finally {
        setAccountLoading(false);
        setLoading(false);
      }
    }
    loadWallet();
  }, [authLoading, user]);

  const balance = Number(wallet?.balance || 0);
  const currency = wallet?.currency || "NGN";
  const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : "";
  function formatAmount(amount: number) { return `₦${Number(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
  function formatDate(value?: string) { if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }); }

  if (authLoading || loading) return <main className="min-h-screen bg-slate-50 p-6 pb-24"><div className="mx-auto max-w-2xl"><p className="text-slate-500">Loading your wallet...</p></div></main>;
  const accountIsActive = virtualAccount?.status === "ACTIVE" && Boolean(virtualAccount.accountNumber);

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <aside className={`fixed inset-y-0 left-0 z-[70] flex flex-col border-r border-slate-200 bg-white shadow-xl transition-all duration-300 ${sidebarOpen ? "w-72" : "w-[76px]"}`} aria-label="Customer navigation">
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-3">
          <div className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${sidebarOpen ? "w-auto opacity-100" : "w-0 opacity-0"}`}><p className="text-xs font-bold tracking-[0.18em] text-emerald-700">PWFB</p><p className="text-sm font-semibold text-slate-900">Customer Wallet</p></div>
          <button type="button" onClick={() => setSidebarOpen((open) => !open)} aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg font-bold text-emerald-700 hover:bg-emerald-100">{sidebarOpen ? "‹" : "›"}</button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = item.href === "/customer-wallet";
            return <Link key={item.href} href={item.href} title={!sidebarOpen ? item.label : undefined} className={`flex items-center rounded-xl px-3 py-3 transition-colors ${active ? "bg-emerald-100 text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-emerald-700"}`}><span className="flex w-7 shrink-0 justify-center text-lg">{item.icon}</span><span className={`ml-2 overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300 ${sidebarOpen ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0"}`}>{item.label}</span></Link>;
          })}
        </nav>
        <div className="border-t border-slate-100 p-3"><div className="flex items-center rounded-xl bg-slate-50 p-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">{(customer?.firstName?.[0] || "P").toUpperCase()}</div><div className={`ml-2 min-w-0 overflow-hidden transition-all duration-300 ${sidebarOpen ? "w-auto opacity-100" : "w-0 opacity-0"}`}><p className="truncate text-xs font-semibold text-slate-900">{customerName || "PWFB Customer"}</p><p className="text-[10px] text-slate-500">Wallet</p></div></div></div>
      </aside>
      {sidebarOpen && <button type="button" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-[60] bg-slate-900/30 md:hidden" />}

      <div className={`mx-auto max-w-2xl px-4 pt-5 transition-[margin] duration-300 md:${sidebarOpen ? "ml-80" : "ml-24"}`}>
        <div className="mb-6 flex items-center gap-3"><button type="button" onClick={() => setSidebarOpen((open) => !open)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-lg text-slate-700 shadow-sm md:hidden" aria-label="Toggle sidebar">☰</button><div><p className="text-sm text-slate-500">MY WALLET</p><h1 className="text-2xl font-bold text-slate-900">Wallet Overview</h1>{customerName && <p className="mt-1 text-sm text-slate-500">Welcome, {customerName}</p>}</div></div>
        {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <section className="mb-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Available Balance</p><div className="mt-2 text-3xl font-bold text-slate-900">{currency === "NGN" ? "₦" : currency + " "}{balance.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></section>
        <section className="mb-5 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-wide text-emerald-700">YOUR PWFB VIRTUAL ACCOUNT</p><h2 className="mt-1 text-lg font-bold text-slate-900">Deposit directly into your wallet</h2></div>{virtualAccount && <span className={`rounded-full px-3 py-1 text-xs font-bold ${accountIsActive ? "bg-emerald-100 text-emerald-700" : virtualAccount.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{accountIsActive ? "ACTIVE" : virtualAccount.status || "PENDING"}</span>}</div>{accountLoading && <p className="mt-4 text-sm text-slate-500">Requesting your virtual account...</p>}{!accountLoading && virtualAccount && <div className="mt-4 space-y-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Bank / Institution</p><p className="font-semibold text-slate-900">{virtualAccount.institutionName || "Provider assignment pending"}</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Account Name</p><p className="break-words font-semibold text-slate-900">{virtualAccount.accountName || customerName || "PWFB customer"}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Account Number</p><p className="font-bold tracking-wide text-slate-900">{virtualAccount.accountNumber || "Being assigned"}</p></div></div><div className="grid grid-cols-2 gap-3 text-xs text-slate-500"><p>Customer ID: <span className="font-semibold text-slate-700">{customer?.id}</span></p><p>Branch ID: <span className="font-semibold text-slate-700">{virtualAccount.branchId || customer?.branchId || "—"}</span></p></div>{accountIsActive ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Send money from any supported bank to this account. Once the provider confirms the incoming payment, PWFB can automatically match it to this wallet.</p> : <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Your virtual account has been requested. The real account number will appear here after the approved provider assigns it. PWFB will never fabricate a bank account number.</p>}</div>}</section>
        <section className="mb-6 grid grid-cols-3 gap-3"><Link href="/banking?operation=deposit" className="rounded-2xl bg-emerald-600 p-4 text-center text-white shadow-sm"><div className="text-xl">₦</div><strong className="mt-1 block text-sm">Deposit</strong></Link><Link href="/banking?operation=withdraw" className="rounded-2xl border border-slate-100 bg-white p-4 text-center text-slate-800 shadow-sm"><div className="text-xl">↗</div><strong className="mt-1 block text-sm">Withdraw</strong></Link><Link href="/banking?operation=transfer" className="rounded-2xl border border-slate-100 bg-white p-4 text-center text-slate-800 shadow-sm"><div className="text-xl">↔</div><strong className="mt-1 block text-sm">Transfer</strong></Link></section>
        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-semibold text-slate-900">Recent Transactions</h2><p className="text-xs text-slate-500">Your latest wallet activity</p></div><Link href="/customer-transactions" className="text-sm font-semibold text-emerald-600">History →</Link></div>{transactions.length === 0 ? <div className="p-8 text-center"><div className="text-3xl">₦</div><p className="mt-2 font-medium text-slate-700">No transactions yet</p><p className="mt-1 text-sm text-slate-500">Your wallet activity will appear here.</p></div> : <div>{transactions.slice(0, 5).map((transaction) => <div key={transaction.id} className="flex items-center justify-between border-b border-slate-100 p-4 last:border-b-0"><div className="min-w-0"><p className="truncate font-medium text-slate-800">{transaction.description || transaction.type || "Transaction"}</p><p className="text-xs text-slate-500">{formatDate(transaction.createdAt || transaction.created_at)}</p></div><div className="ml-4 font-semibold text-slate-900">{formatAmount(Number(transaction.amount || 0))}</div></div>)}</div>}</section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white md:hidden"><div className="mx-auto flex max-w-2xl items-center justify-around px-1 py-2"><Link href="/customer-dashboard" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">⌂</span><span className="text-[10px]">Home</span></Link><Link href="/banking?operation=deposit" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">₦</span><span className="text-[10px]">Deposit</span></Link><Link href="/banking?operation=withdraw" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">↗</span><span className="text-[10px]">Withdrawal</span></Link><Link href="/customer-savings" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">💰</span><span className="text-[10px]">Saving</span></Link><Link href="/customer-loans" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">▣</span><span className="text-[10px]">Loan</span></Link><Link href="/customer-more" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">•••</span><span className="text-[10px]">More</span></Link></div></nav>
    </main>
  );
}
