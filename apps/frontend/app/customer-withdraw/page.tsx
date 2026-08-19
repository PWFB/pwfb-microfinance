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

        if (!customer?.id) {
          throw new Error("Customer account could not be found.");
        }

        setCustomerId(customer.id);

        const customerWallet =
          await pwfbApi.banking.customerWallet(customer.id);

        setWallet(customerWallet);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load your wallet.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadWallet();
  }, [authLoading, user, router]);

  const balance = Number(wallet?.balance || 0);

  const money = (value: number) =>
    `₦${Number(value || 0).toLocaleString("en-NG", {
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
        description:
          description.trim() || "Customer wallet withdrawal",
      });

      setWallet(result?.wallet || wallet);

      setAmount("");
      setDescription("");
      setSuccess(true);
      setMessage(
        "Withdrawal completed successfully.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Withdrawal could not be completed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-emerald-700">
          Loading withdrawal...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-2xl px-4 pt-5">

        <Link
          href="/customer-dashboard"
          className="inline-flex items-center text-sm font-semibold text-emerald-700"
        >
          ← Back to Dashboard
        </Link>

        <div className="mt-5 mb-6">
          <p className="text-sm text-slate-500">
            PWFB WALLET
          </p>

          <h1 className="text-2xl font-bold text-slate-900">
            Withdraw
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Withdraw funds from your PWFB wallet.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Available Balance
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {money(balance)}
          </p>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">

          <h2 className="text-lg font-bold text-slate-900">
            Withdrawal Amount
          </h2>

          <div className="mt-5">
            <label className="block text-sm font-medium text-slate-700">
              Amount
            </label>

            <div className="mt-2 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4">
              <span className="text-lg font-semibold text-slate-500">
                ₦
              </span>

              <input
                type="number"
                min="1"
                max={balance}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent px-3 py-4 text-xl font-semibold outline-none"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-medium text-slate-700">
              Description
            </label>

            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Only withdraw an amount that is available in your wallet.
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={submitWithdrawal}
            className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-4 font-semibold text-white disabled:opacity-60"
          >
            {submitting
              ? "Processing..."
              : "Confirm Withdrawal"}
          </button>

          {message && (
            <div
              className={`mt-4 rounded-xl p-4 text-sm ${
                success
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {message}
            </div>
          )}
        </section>
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
            href="/customer-deposit"
            className="flex flex-col items-center px-2 py-1 text-slate-600"
          >
            <span className="text-lg">＋</span>
            <span className="text-[10px]">Deposit</span>
          </Link>

          <Link
            href="/customer-withdraw"
            className="flex flex-col items-center px-2 py-1 text-emerald-600"
          >
            <span className="text-lg">↗</span>
            <span className="text-[10px] font-semibold">
              Withdraw
            </span>
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
