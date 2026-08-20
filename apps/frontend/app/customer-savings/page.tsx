"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Savings = {
  id: string;
  amount?: number;
  balance?: number;
  currentBalance?: number;
  accountType?: string;
  status?: string;
  createdAt?: string;
};

export default function CustomerSavingsPage() {
  const { user, loading: authLoading } = useAuth();

  const [savings, setSavings] = useState<Savings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;

    async function loadSavings() {
      try {
        setLoading(true);
        setError("");

        /*
         * Customer endpoint should return only the
         * authenticated customer's savings records.
         */
        const data = await pwfbApi.customers.me();

        const records = Array.isArray(data?.savings)
          ? data.savings
          : [];

        setSavings(records);
      } catch (err) {
        console.error("Customer savings load failed:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your savings.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadSavings();
  }, [authLoading, user]);

  const totalSavings = savings.reduce(
    (total, item) =>
      total +
      Number(
        item.balance ??
        item.currentBalance ??
        item.amount ??
        0,
      ),
    0,
  );

  const money = (value: number) =>
    `₦${Number(value || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-emerald-700">Loading your savings...</p>
      </main>
    );
  }

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
            PWFB SAVINGS
          </p>

          <h1 className="text-2xl font-bold text-slate-900">
            My Savings
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            View and manage your savings with PWFB.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">
            Total Savings
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {money(totalSavings)}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {savings.length} savings account
            {savings.length === 1 ? "" : "s"}
          </p>
        </section>

        <section className="mt-5 space-y-3">
          {savings.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
              <div className="text-3xl">💰</div>

              <h2 className="mt-3 font-semibold text-slate-900">
                No savings records yet
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Your savings activity will appear here.
              </p>

              <Link
                href="/customer-deposit"
                className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Make a Deposit
              </Link>
            </div>
          ) : (
            savings.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {item.accountType || "Savings Account"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {item.status || "Active"}
                    </p>
                  </div>

                  <p className="text-lg font-bold text-emerald-700">
                    {money(
                      Number(
                        item.balance ??
                        item.currentBalance ??
                        item.amount ??
                        0,
                      ),
                    )}
                  </p>
                </div>
              </div>
            ))
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
            href="/customer-savings"
            className="flex flex-col items-center px-2 py-1 text-emerald-600"
          >
            <span className="text-lg">💰</span>
            <span className="text-[10px] font-semibold">Saving</span>
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
