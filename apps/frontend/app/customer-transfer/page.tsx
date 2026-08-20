"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Wallet = {
  balance?: number;
};

export default function CustomerTransferPage() {
  const { user, loading: authLoading } = useAuth();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [recipientCustomerId, setRecipientCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;

    async function loadWallet() {
      try {
        setLoading(true);
        setError("");

        const customerId =
          (user as any).customerId || (user as any).customer?.id;

        if (!customerId) {
          throw new Error("Customer account could not be identified.");
        }

        const data = await pwfbApi.banking.customerWallet(customerId);
        setWallet(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load your wallet.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadWallet();
  }, [authLoading, user]);

  const money = (value: number) =>
    `₦${Number(value || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const customerId =
      (user as any)?.customerId || (user as any)?.customer?.id;
    const numericAmount = Number(amount);

    if (!customerId) {
      setError("Customer account could not be identified.");
      return;
    }

    if (!recipientCustomerId.trim()) {
      setError("Enter the recipient customer ID.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid transfer amount greater than zero.");
      return;
    }

    if (numericAmount > Number(wallet?.balance ?? 0)) {
      setError("Insufficient wallet balance.");
      return;
    }

    try {
      setSubmitting(true);

      const result = await pwfbApi.banking.transfer(customerId, {
        recipientCustomerId: recipientCustomerId.trim(),
        amount: numericAmount,
        description: description.trim() || "Customer wallet transfer",
      });

      setWallet(result?.senderWallet || wallet);
      setAmount("");
      setDescription("");
      setRecipientCustomerId("");
      setMessage("Transfer completed successfully.");
    } catch (err) {
      console.error("Customer transfer failed:", err);
      setError(
        err instanceof Error ? err.message : "Unable to complete transfer.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-xl text-emerald-700">↔</div>
          <p className="mt-3 font-medium text-emerald-700">Loading your wallet...</p>
        </div>
      </main>
    );
  }

  const balance = Number(wallet?.balance ?? 0);

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-2xl px-4 pt-5">
        <Link
          href="/customer-dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"
        >
          ← Dashboard
        </Link>

        <header className="mt-5 mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            PWFB WALLET
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Transfer Money</h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Send money securely to another PWFB customer.
          </p>
        </header>

        <section className="overflow-hidden rounded-3xl bg-emerald-700 p-6 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-emerald-100">Available Balance</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{money(balance)}</p>
              <p className="mt-2 text-xs text-emerald-100">
                This is the balance available for transfers.
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl">
              ↔
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"
        >
          <div className="mb-5">
            <h2 className="text-base font-bold text-slate-900">Transfer details</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Check the recipient ID and amount before confirming your transfer.
            </p>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Recipient Customer ID
          </label>
          <input
            value={recipientCustomerId}
            onChange={(e) => setRecipientCustomerId(e.target.value)}
            placeholder="Enter customer ID"
            autoComplete="off"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          />

          <label className="mt-5 block text-sm font-semibold text-slate-700">
            Amount
          </label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-slate-400">₦</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-10 pr-4 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">Maximum available: {money(balance)}</p>

          <label className="mt-5 block text-sm font-semibold text-slate-700">
            Description <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this transfer for?"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          />

          <button
            type="submit"
            disabled={submitting || balance <= 0}
            className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Processing Transfer..." : balance <= 0 ? "No Available Balance" : "Transfer Money"}
          </button>
        </form>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
          Transfers can only be made from your available wallet balance. Confirm the recipient details before submitting.
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-1 py-2">
          <Link href="/customer-dashboard" className="flex flex-col items-center px-2 py-1 text-slate-600">
            <span className="text-lg">⌂</span><span className="text-[10px]">Home</span>
          </Link>
          <Link href="/customer-wallet" className="flex flex-col items-center px-2 py-1 text-slate-600">
            <span className="text-lg">₦</span><span className="text-[10px]">Wallet</span>
          </Link>
          <Link href="/customer-savings" className="flex flex-col items-center px-2 py-1 text-slate-600">
            <span className="text-lg">💰</span><span className="text-[10px]">Saving</span>
          </Link>
          <Link href="/customer-loans" className="flex flex-col items-center px-2 py-1 text-slate-600">
            <span className="text-lg">▣</span><span className="text-[10px]">Loan</span>
          </Link>
          <Link href="/customer-more" className="flex flex-col items-center px-2 py-1 text-emerald-700">
            <span className="text-lg">•••</span><span className="text-[10px] font-semibold">More</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
