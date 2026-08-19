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
};

type Wallet = {
  balance?: number;
  currency?: string;
};

type Transaction = {
  id: string;
  type?: string;
  amount?: number;
  description?: string;
  status?: string;
  createdAt?: string;
  created_at?: string;
};

export default function CustomerDashboardPage() {
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);

        const profile = await pwfbApi.customers.me();

        setCustomer(profile);

        if (profile?.id) {
          const [customerWallet, customerTransactions] = await Promise.all([
            pwfbApi.banking.customerWallet(profile.id),
            pwfbApi.banking.customerTransactions(profile.id),
          ]);

          setWallet(customerWallet);

          const transactionList = Array.isArray(customerTransactions)
            ? customerTransactions
            : (customerTransactions?.data ?? []);

          setTransactions(transactionList);
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

  const formatDate = (value?: string) => {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const savingsBalance =
    customer?.savings?.reduce(
      (total, item) =>
        total + Number(item.balance ?? item.amount ?? item.currentBalance ?? 0),
      0,
    ) || 0;

  const borrowedLoan =
    customer?.loans?.reduce(
      (total, loan) =>
        total +
        Number(loan.amount ?? loan.principalAmount ?? loan.loanAmount ?? 0),
      0,
    ) || 0;

  const loanBalance =
    customer?.loans?.reduce(
      (total, loan) =>
        total +
        Number(
          loan.outstandingBalance ?? loan.balance ?? loan.remainingBalance ?? 0,
        ),
      0,
    ) || 0;

  const displayName =
    [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") ||
    "Customer";

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
        {/* HEADER */}
        <div className="mb-5">
          <p className="text-sm text-slate-500">Welcome back</p>

          <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
        </div>

        {/* WALLET SUMMARY */}
        <section className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Available Balance
            </p>

            <p className="mt-4 text-xl font-bold text-slate-900">
              {money(Number(wallet?.balance || 0))}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Savings Balance
            </p>

            <p className="mt-4 text-xl font-bold text-slate-900">
              {money(savingsBalance)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Borrowed Loan</p>

            <p className="mt-4 text-xl font-bold text-slate-900">
              {money(borrowedLoan)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Loan Balance</p>

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
              href="/customer-deposit"
              className="rounded-xl bg-emerald-600 p-4 text-center text-white"
            >
              <span className="block text-xl">₦</span>

              <span className="mt-1 block text-xs font-semibold">Deposit</span>
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
              href="/customer-transfer"
              className="rounded-xl border border-slate-200 bg-white p-4 text-center text-slate-800"
            >
              <span className="block text-xl">↔</span>

              <span className="mt-1 block text-xs font-semibold">Transfer</span>
            </Link>
          </div>
        </section>

        {/* RECENT TRANSACTIONS */}
        <section className="mt-6 rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div>
              <h2 className="font-semibold text-slate-900">
                Recent Transactions
              </h2>

              <p className="text-xs text-slate-500">
                Your latest wallet activity
              </p>
            </div>

            <Link
              href="/customer-transactions"
              className="text-sm font-semibold text-emerald-600"
            >
              History →
            </Link>
          </div>

          {transactions.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-2xl">₦</div>

              <p className="mt-2 font-medium text-slate-700">
                No transactions yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Your wallet activity will appear here.
              </p>
            </div>
          ) : (
            <div>
              {transactions.slice(0, 5).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between border-b border-slate-100 p-4 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">
                      {transaction.description ||
                        transaction.type ||
                        "Transaction"}
                    </p>

                    <p className="text-xs text-slate-500">
                      {formatDate(
                        transaction.createdAt || transaction.created_at,
                      )}
                    </p>
                  </div>

                  <p className="ml-4 font-semibold text-slate-900">
                    {money(Number(transaction.amount || 0))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* CUSTOMER MOBILE NAVIGATION */}
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
