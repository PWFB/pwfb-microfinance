"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pwfbApi } from "../../lib/pwfb-api";

type Customer = {
  id: string;
  firstName?: string;
  lastName?: string;
  savings?: any[];
  loans?: any[];
  transactions?: any[];
};

type Wallet = {
  balance?: number;
  currency?: string;
};

export default function CustomerDashboardPage() {
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const profile = await pwfbApi.customers.me();

        setCustomer(profile);

        if (profile?.id) {
          const customerWallet =
            await pwfbApi.banking.customerWallet(profile.id);

          setWallet(customerWallet);
        }
      } catch (error) {
        console.error("Customer dashboard failed:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const money = (value: number) =>
    `₦${Number(value || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const savingsBalance =
    customer?.savings?.reduce(
      (total, item) =>
        total + Number(
          item.balance ??
          item.amount ??
          item.currentBalance ??
          0
        ),
      0,
    ) || 0;

  const borrowedLoan =
    customer?.loans?.reduce(
      (total, loan) =>
        total + Number(
          loan.amount ??
          loan.principalAmount ??
          loan.loanAmount ??
          0
        ),
      0,
    ) || 0;

  const loanBalance =
    customer?.loans?.reduce(
      (total, loan) =>
        total + Number(
          loan.outstandingBalance ??
          loan.balance ??
          loan.remainingBalance ??
          0
        ),
      0,
    ) || 0;

  const displayName =
    [customer?.firstName].filter(Boolean).join(" ") || "Customer";

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-emerald-700">Loading your wallet...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-2xl px-4 pt-5">

        <div className="mb-5">
          <p className="text-sm text-slate-500">
            Welcome back
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            {displayName}
          </h1>
        </div>

        {/* EXACTLY 4 CARDS */}
        <section className="grid grid-cols-2 gap-4">

          <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
            <p className="text-sm font-medium text-slate-500">
              Available Balance
            </p>
            <p className="mt-4 text-xl font-bold text-slate-900">
              {money(Number(wallet?.balance || 0))}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
            <p className="text-sm font-medium text-slate-500">
              Savings Balance
            </p>
            <p className="mt-4 text-xl font-bold text-slate-900">
              {money(savingsBalance)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
            <p className="text-sm font-medium text-slate-500">
              Borrowed Loan
            </p>
            <p className="mt-4 text-xl font-bold text-slate-900">
              {money(borrowedLoan)}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
            <p className="text-sm font-medium text-slate-500">
              Loan Balance
            </p>
            <p className="mt-4 text-xl font-bold text-slate-900">
              {money(loanBalance)}
            </p>
          </div>

        </section>

        {/* QUICK ACTIONS */}
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold text-slate-900">
            Quick Actions
          </h2>

          <div className="grid grid-cols-3 gap-3">

            <Link
              href="/banking?operation=deposit"
              className="rounded-xl bg-emerald-600 p-4 text-center text-white"
            >
              <span className="block text-xl">₦</span>
              <span className="mt-1 block text-xs font-semibold">
                Deposit
              </span>
            </Link>

            <Link
              href="/banking?operation=withdraw"
              className="rounded-xl bg-orange-500 p-4 text-center text-white"
            >
              <span className="block text-xl">↗</span>
              <span className="mt-1 block text-xs font-semibold">
                Withdrawal
              </span>
            </Link>

            <Link
              href="/savings"
              className="rounded-xl bg-white p-4 text-center text-slate-800 border border-slate-200"
            >
              <span className="block text-xl">💰</span>
              <span className="mt-1 block text-xs font-semibold">
                Saving
              </span>
            </Link>

          </div>
        </section>

      </div>

      {/* MOBILE APP BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">

          <Link
            href="/customer-dashboard"
            className="flex flex-col items-center px-2 py-1 text-emerald-600"
          >
            <span className="text-lg">⌂</span>
            <span className="text-[10px] font-semibold">Home</span>
          </Link>

          <Link
            href="/banking?operation=deposit"
            className="flex flex-col items-center px-2 py-1 text-slate-600"
          >
            <span className="text-lg">₦</span>
            <span className="text-[10px]">Deposit</span>
          </Link>

          <Link
            href="/banking?operation=withdraw"
            className="flex flex-col items-center px-2 py-1 text-slate-600"
          >
            <span className="text-lg">↗</span>
            <span className="text-[10px]">Withdrawal</span>
          </Link>

          <Link
            href="/savings"
            className="flex flex-col items-center px-2 py-1 text-slate-600"
          >
            <span className="text-lg">💰</span>
            <span className="text-[10px]">Saving</span>
          </Link>

          <Link
            href="/loans"
            className="flex flex-col items-center px-2 py-1 text-slate-600"
          >
            <span className="text-lg">▣</span>
            <span className="text-[10px]">Loan</span>
          </Link>

          <button
            type="button"
            onClick={() => router.push("/customer-more")}
            className="flex flex-col items-center px-2 py-1 text-slate-600"
          >
            <span className="text-lg">•••</span>
            <span className="text-[10px]">More</span>
          </button>

        </div>
      </nav>
    </main>
  );
}
