"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Customer = {
  id: string;
  firstName?: string;
  lastName?: string;
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

export default function CustomerWalletPage() {
  const { user, loading: authLoading } = useAuth();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;

    async function loadWallet() {
      try {
        setLoading(true);
        setError("");

        const customerData = await pwfbApi.customers.me();

        setCustomer(customerData);

        const [walletData, transactionData] = await Promise.all([
          pwfbApi.banking.customerWallet(customerData.id),
          pwfbApi.banking.customerTransactions(customerData.id),
        ]);

        setWallet(walletData);

        const list = Array.isArray(transactionData)
          ? transactionData
          : transactionData?.data ?? [];

        setTransactions(list);
      } catch (err) {
        console.error("Customer wallet load failed:", err);

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

  const balance = Number(wallet?.balance || 0);
  const currency = wallet?.currency || "NGN";

  const customerName = customer
    ? [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(" ")
    : "";

  function formatAmount(amount: number) {
    return `₦${Number(amount || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(value?: string) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 pb-24">
        <div className="mx-auto max-w-2xl">
          <p className="text-slate-500">Loading your wallet...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-2xl px-4 pt-5">

        <div className="mb-6">
          <p className="text-sm text-slate-500">MY WALLET</p>

          <h1 className="text-2xl font-bold text-slate-900">
            Wallet Overview
          </h1>

          {customerName && (
            <p className="mt-1 text-sm text-slate-500">
              Welcome, {customerName}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* AVAILABLE BALANCE */}
        <section className="mb-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Available Balance
          </p>

          <div className="mt-2 text-3xl font-bold text-slate-900">
            {currency === "NGN" ? "₦" : currency + " "}
            {balance.toLocaleString("en-NG", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </section>

        {/* WALLET ACTIONS */}
        <section className="mb-6 grid grid-cols-3 gap-3">

          <Link
            href="/banking?operation=deposit"
            className="rounded-2xl bg-emerald-600 p-4 text-center text-white shadow-sm"
          >
            <div className="text-xl">₦</div>
            <strong className="mt-1 block text-sm">
              Deposit
            </strong>
          </Link>

          <Link
            href="/banking?operation=withdraw"
            className="rounded-2xl bg-white p-4 text-center text-slate-800 shadow-sm border border-slate-100"
          >
            <div className="text-xl">↗</div>
            <strong className="mt-1 block text-sm">
              Withdraw
            </strong>
          </Link>

          <Link
            href="/banking?operation=transfer"
            className="rounded-2xl bg-white p-4 text-center text-slate-800 shadow-sm border border-slate-100"
          >
            <div className="text-xl">↔</div>
            <strong className="mt-1 block text-sm">
              Transfer
            </strong>
          </Link>

        </section>

        {/* RECENT TRANSACTIONS */}
        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">

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
            <div className="p-8 text-center">
              <div className="text-3xl">₦</div>

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
                        transaction.createdAt ||
                          transaction.created_at,
                      )}
                    </p>
                  </div>

                  <div className="ml-4 font-semibold text-slate-900">
                    {formatAmount(Number(transaction.amount || 0))}
                  </div>
                </div>
              ))}
            </div>
          )}

        </section>

      </div>

      {/* CUSTOMER BOTTOM NAVIGATION */}
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
