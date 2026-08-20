"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Wallet = {
  balance?: number;
  currency?: string;
};

export default function CustomerWithdrawPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [customerId, setCustomerId] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "CUSTOMER") {
      router.replace("/dashboard");
      return;
    }

    async function loadWallet() {
      try {
        const customer = await pwfbApi.customers.me();
        if (!customer?.id) throw new Error("Customer account could not be found.");

        setCustomerId(customer.id);
        setWallet(await pwfbApi.banking.customerWallet(customer.id));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load your wallet.");
      } finally {
        setLoading(false);
      }
    }

    loadWallet();
  }, [authLoading, user, router]);

  const balance = Number(wallet?.balance || 0);
  const currency = wallet?.currency || "NGN";
  const money = (value: number) =>
    `${currency === "NGN" ? "₦" : `${currency} `}${Number(value || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  async function submitWithdrawal() {
    setMessage("");
    setSuccess(false);
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage("Enter a valid withdrawal amount greater than zero.");
      return;
    }
    if (numericAmount > balance) {
      setMessage("Insufficient wallet balance.");
      return;
    }
    if (!customerId) {
      setMessage("Customer account is not available.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await pwfbApi.banking.withdraw(customerId, {
        amount: numericAmount,
        description: description.trim() || "Customer wallet withdrawal",
      });

      setWallet(result?.wallet || wallet);
      setAmount("");
      setDescription("");
      setSuccess(true);
      setMessage("Withdrawal completed successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Withdrawal could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-[#f4faf6] flex items-center justify-center">
        <p className="font-medium text-emerald-700">Loading withdrawal...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4faf6] pb-24">
      <div className="mx-auto w-full max-w-2xl px-4 pt-5">
        <Link href="/customer-dashboard" className="inline-flex items-center rounded-full bg-white px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-100">
          ← Back
        </Link>

        <header className="mt-5 mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">PWFB WALLET</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Withdraw</h1>
          <p className="mt-1 text-sm text-slate-500">Withdraw funds from your PWFB wallet.</p>
        </header>

        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-green-500 p-6 text-white shadow-lg shadow-emerald-900/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">Available Balance</p>
              <p className="mt-3 text-4xl font-bold tracking-tight">{money(balance)}</p>
              <p className="mt-2 text-sm text-emerald-100">Amount currently available to withdraw</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold ring-1 ring-white/20">↗</div>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">Move money out</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Withdrawal Amount</h2>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-semibold text-slate-700">Amount</label>
            <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-50">
              <span className="text-lg font-bold text-emerald-600">₦</span>
              <input type="number" min="1" max={balance} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-transparent px-3 py-4 text-xl font-semibold text-slate-900 outline-none placeholder:text-slate-300" />
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>Available to withdraw</span>
              <span className="font-semibold text-emerald-700">{money(balance)}</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span></label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this withdrawal for?" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50" />
          </div>

          <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
            You can only withdraw funds that are currently available in your PWFB wallet.
          </div>

          <button type="button" disabled={submitting} onClick={submitWithdrawal} className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-4 font-bold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "Processing..." : "Confirm Withdrawal"}
          </button>

          {message && <div className={`mt-4 rounded-2xl p-4 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message}</div>}
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">
          <Link href="/customer-dashboard" className="flex flex-col items-center px-2 py-1 text-slate-500"><span className="text-lg">⌂</span><span className="text-[10px]">Home</span></Link>
          <Link href="/customer-wallet" className="flex flex-col items-center px-2 py-1 text-slate-500"><span className="text-lg">₦</span><span className="text-[10px]">Wallet</span></Link>
          <Link href="/customer-deposit" className="flex flex-col items-center px-2 py-1 text-slate-500"><span className="text-lg">＋</span><span className="text-[10px]">Deposit</span></Link>
          <Link href="/customer-withdraw" className="flex flex-col items-center px-2 py-1 text-emerald-600"><span className="text-lg">↗</span><span className="text-[10px] font-bold">Withdraw</span></Link>
          <Link href="/customer-more" className="flex flex-col items-center px-2 py-1 text-slate-500"><span className="text-lg">•••</span><span className="text-[10px]">More</span></Link>
        </div>
      </nav>
    </main>
  );
}
