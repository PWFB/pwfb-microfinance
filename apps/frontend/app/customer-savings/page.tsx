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

        const data = await pwfbApi.customers.me();
        const records = Array.isArray(data?.savings) ? data.savings : [];
        setSavings(records);
      } catch (err) {
        console.error("Customer savings load failed:", err);
        setError(
          err instanceof Error ? err.message : "Unable to load your savings.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadSavings();
  }, [authLoading, user]);

  const totalSavings = savings.reduce(
    (total, item) =>
      total + Number(item.balance ?? item.currentBalance ?? item.amount ?? 0),
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
          className="inline-flex items-center text-sm font-semibold text-emerald-700"
        >
          ← Dashboard
        </Link>

        <header className="mt-5 mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
            PWFB Savings
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">My Savings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Keep track of your savings balances and activity.
          </p>
        </header>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-3xl bg-emerald-700 p-6 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-emerald-100">Total Savings</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {money(totalSavings)}
              </p>
            </div>
            <span className="rounded-2xl bg-white/15 px-3 py-2 text-xl">💰</span>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-white/15 pt-4 text-sm">
            <span className="text-emerald-100">
              {savings.length} savings account{savings.length === 1 ? "" : "s"}
            </span>
            <Link
              href="/customer-deposit"
              className="font-semibold text-white underline-offset-4 hover:underline"
            >
              Add money →
            </Link>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Your Accounts</h2>
              <p className="text-xs text-slate-500">Your current savings balances</p>
            </div>
          </div>

          {savings.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                💰
              </div>
              <h2 className="mt-3 font-semibold text-slate-900">No savings records yet</h2>
              <p className="mt-1 text-sm text-slate-500">
                Your savings activity will appear here.
              </p>
              <Link
                href="/customer-deposit"
                className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm"
              >
                Make a Deposit
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {savings.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {item.accountType || "Savings Account"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.status || "Active"}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-bold text-emerald-700">
                      {money(
                        Number(item.balance ?? item.currentBalance ?? item.amount ?? 0),
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-1 py-2">
          <Link href="/customer-dashboard" className="flex flex-col items-center px-2 py-1 text-slate-600">
            <span className="text-lg">⌂</span>
            <span className="text-[10px]">Home</span>
          </Link>
          <Link href="/customer-wallet" className="flex flex-col items-center px-2 py-1 text-slate-600">
            <span className="text-lg">₦</span>
            <span className="text-[10px]">Wallet</span>
          </Link>
          <Link href="/customer-savings" className="flex flex-col items-center px-2 py-1 text-emerald-600">
            <span className="text-lg">💰</span>
            <span className="text-[10px] font-semibold">Saving</span>
          </Link>
          <Link href="/customer-loans" className="flex flex-col items-center px-2 py-1 text-slate-600">
            <span className="text-lg">▣</span>
            <span className="text-[10px]">Loan</span>
          </Link>
          <Link href="/customer-more" className="flex flex-col items-center px-2 py-1 text-slate-600">
            <span className="text-lg">•••</span>
            <span className="text-[10px]">More</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
