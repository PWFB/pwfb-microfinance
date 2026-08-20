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

        const customerId =
          (user as any).customerId ||
          (user as any).customer?.id;

        if (!customerId) {
          throw new Error("Customer account could not be identified.");
        }

        const data =
          await pwfbApi.banking.customerWallet(customerId);

        setWallet(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your wallet.",
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
      (user as any)?.customerId ||
      (user as any)?.customer?.id;

    if (!customerId) {
      setError("Customer account could not be identified.");
      return;
    }

    const numericAmount = Number(amount);

    if (!recipientCustomerId.trim()) {
      setError("Enter the recipient customer ID.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid transfer amount.");
      return;
    }

    if (
      numericAmount >
      Number(wallet?.balance ?? 0)
    ) {
      setError("Insufficient wallet balance.");
      return;
    }

    try {
      setSubmitting(true);

      const result =
        await pwfbApi.banking.transfer(
          customerId,
          {
            recipientCustomerId:
              recipientCustomerId.trim(),
            amount: numericAmount,
            description:
              description.trim() ||
              "Customer wallet transfer",
          },
        );

      setWallet(result?.senderWallet || wallet);

      setAmount("");
      setDescription("");
      setRecipientCustomerId("");

      setMessage(
        "Transfer completed successfully.",
      );
    } catch (err) {
      console.error("Customer transfer failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete transfer.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-emerald-700">
          Loading your wallet...
        </p>
      </main>
    );
  }

  const balance = Number(wallet?.balance ?? 0);

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-2xl px-4 pt-5">

        <Link
          href="/customer-dashboard"
          className="text-sm font-semibold text-emerald-700"
        >
          ← Dashboard
        </Link>

        <div className="mt-5 mb-6">
          <p className="text-sm text-slate-500">
            PWFB WALLET
          </p>

          <h1 className="text-2xl font-bold text-slate-900">
            Transfer Money
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Send money securely to another PWFB customer.
          </p>
        </div>

        <section className="rounded-2xl bg-emerald-700 p-5 text-white shadow-sm">
          <p className="text-sm text-emerald-100">
            Available Balance
          </p>

          <p className="mt-2 text-3xl font-bold">
            {money(balance)}
          </p>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
        >
          <label className="block text-sm font-semibold text-slate-700">
            Recipient Customer ID
          </label>

          <input
            value={recipientCustomerId}
            onChange={(e) =>
              setRecipientCustomerId(e.target.value)
            }
            placeholder="Enter customer ID"
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
          />

          <label className="mt-5 block text-sm font-semibold text-slate-700">
            Amount
          </label>

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value)
            }
            placeholder="₦0.00"
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
          />

          <label className="mt-5 block text-sm font-semibold text-slate-700">
            Description
          </label>

          <input
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            placeholder="Optional transfer description"
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
          />

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {submitting
              ? "Processing Transfer..."
              : "Transfer Money"}
          </button>
        </form>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-1 py-2">

          <Link
            href="/customer-dashboard"
            className="flex flex-col items-center px-2 py-1 text-slate-600"
          >
            <span className="text-lg">⌂</span>
            <span className="text-[10px]">Home</span>
          </Link>

          <Link
            href="/customer-wallet"
            className="flex flex-col items-center px-2 py-1 text-slate-600"
          >
            <span className="text-lg">₦</span>
            <span className="text-[10px]">Wallet</span>
          </Link>

          <Link
            href="/customer-savings"
            className="flex flex-col items-center px-2 py-1 text-slate-600"
          >
            <span className="text-lg">💰</span>
            <span className="text-[10px]">Saving</span>
          </Link>

          <Link
            href="/customer-loans"
            className="flex flex-col items-center px-2 py-1 text-slate-600"
          >
            <span className="text-lg">▣</span>
            <span className="text-[10px]">Loan</span>
          </Link>

          <Link
            href="/customer-more"
            className="flex flex-col items-center px-2 py-1 text-slate-600"
          >
            <span className="text-lg">•••</span>
            <span className="text-[10px]">More</span>
          </Link>

        </div>
      </nav>
    </main>
  );
}
