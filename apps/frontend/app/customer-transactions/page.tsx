"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Customer = { id: string; firstName?: string; lastName?: string };
type Transaction = { id: string; type?: string; amount?: number; description?: string; reference?: string; status?: string; createdAt?: string; created_at?: string };

export default function CustomerTransactionsPage() {
  const { user, loading: authLoading } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    async function loadTransactions() {
      try {
        setLoading(true); setError("");
        const customerData = await pwfbApi.customers.me();
        setCustomer(customerData);
        const data = await pwfbApi.banking.customerTransactions(customerData.id);
        setTransactions(Array.isArray(data) ? data : data?.data ?? []);
      } catch (err) {
        console.error("Customer transactions load failed:", err);
        setError(err instanceof Error ? err.message : "Unable to load your transactions.");
      } finally { setLoading(false); }
    }
    loadTransactions();
  }, [authLoading, user]);

  const money = (amount: number) => `₦${Number(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = (value?: string) => { if (!value) return "Date unavailable"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "Date unavailable" : d.toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
  const label = (type?: string) => ({ DEPOSIT: "Deposit", WITHDRAWAL: "Withdrawal", TRANSFER_IN: "Transfer Received", TRANSFER_OUT: "Transfer Sent" }[type || ""] || type || "Transaction");
  const incoming = (type?: string) => type === "DEPOSIT" || type === "TRANSFER_IN";
  const icon = (type?: string) => ({ DEPOSIT: "↓", WITHDRAWAL: "↑", TRANSFER_IN: "↙", TRANSFER_OUT: "↗" }[type || ""] || "₦");
  const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : "";
  const totalIncoming = transactions.filter(t => incoming(t.type)).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalOutgoing = transactions.filter(t => !incoming(t.type)).reduce((sum, t) => sum + Number(t.amount || 0), 0);

  if (authLoading || loading) return <main className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-emerald-700">Loading transaction history...</p></main>;

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-2xl px-4 pt-5">
        <Link href="/customer-wallet" className="text-sm font-semibold text-emerald-700">← Wallet</Link>
        <div className="mb-6 mt-5">
          <p className="text-xs font-bold tracking-wider text-emerald-700">PWFB WALLET</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Transaction History</h1>
          {customerName && <p className="mt-1 text-sm text-slate-500">Account activity for {customerName}</p>}
        </div>

        {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <section className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-emerald-700 p-4 text-white shadow-sm"><p className="text-xs text-emerald-100">Money In</p><p className="mt-1 text-lg font-bold">{money(totalIncoming)}</p></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100"><p className="text-xs text-slate-500">Money Out</p><p className="mt-1 text-lg font-bold text-orange-600">{money(totalOutgoing)}</p></div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-900">All Transactions</h2><p className="mt-1 text-xs text-slate-500">Your complete wallet activity</p></div>
          {transactions.length === 0 ? (
            <div className="p-10 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">₦</div><h3 className="mt-4 font-semibold text-slate-800">No transactions yet</h3><p className="mt-1 text-sm text-slate-500">Your deposits, withdrawals and transfers will appear here.</p><Link href="/customer-deposit" className="mt-5 inline-block rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white">Make a Deposit</Link></div>
          ) : transactions.map(t => {
            const isIn = incoming(t.type);
            return <div key={t.id} className="border-b border-slate-100 p-4 last:border-b-0"><div className="flex items-start gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold ${isIn ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"}`}>{icon(t.type)}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">{label(t.type)}</p><p className="mt-1 text-xs text-slate-500">{date(t.createdAt || t.created_at)}</p></div><p className={`shrink-0 font-bold ${isIn ? "text-emerald-600" : "text-orange-600"}`}>{isIn ? "+" : "-"}{money(Number(t.amount || 0))}</p></div>{t.description && <p className="mt-2 text-sm text-slate-600">{t.description}</p>}{t.reference && <p className="mt-1 text-[11px] text-slate-400">Ref: {t.reference}</p>}{t.status && <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium uppercase text-slate-600">{t.status}</span>}</div></div></div>;
          })}
        </section>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-2xl items-center justify-around px-1 py-2">
        <Link href="/customer-dashboard" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">⌂</span><span className="text-[10px]">Home</span></Link>
        <Link href="/customer-wallet" className="flex flex-col items-center px-2 py-1 text-emerald-600"><span className="text-lg">₦</span><span className="text-[10px] font-semibold">Wallet</span></Link>
        <Link href="/customer-savings" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">💰</span><span className="text-[10px]">Saving</span></Link>
        <Link href="/customer-loans" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">▣</span><span className="text-[10px]">Loan</span></Link>
        <Link href="/customer-more" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">•••</span><span className="text-[10px]">More</span></Link>
      </div></nav>
    </main>
  );
}
