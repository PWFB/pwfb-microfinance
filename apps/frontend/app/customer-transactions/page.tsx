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

type Transaction = {
  id: string;
  type?: string;
  amount?: number;
  description?: string;
  reference?: string;
  status?: string;
  createdAt?: string;
  created_at?: string;
};

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
        setLoading(true);
        setError("");

        const customerData = await pwfbApi.customers.me();

        setCustomer(customerData);

        const data =
          await pwfbApi.banking.customerTransactions(
            customerData.id,
          );

        const list = Array.isArray(data)
          ? data
          : data?.data ?? [];

        setTransactions(list);
      } catch (err) {
        console.error(
          "Customer transactions load failed:",
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your transactions.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadTransactions();
  }, [authLoading, user]);

  function formatAmount(amount: number) {
    return `₦${Number(amount || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(value?: string) {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function transactionLabel(type?: string) {
    switch (type) {
      case "DEPOSIT":
        return "Deposit";

      case "WITHDRAWAL":
        return "Withdrawal";

      case "TRANSFER_IN":
        return "Transfer Received";

      case "TRANSFER_OUT":
        return "Transfer Sent";

      default:
        return type || "Transaction";
    }
  }

  function isIncoming(type?: string) {
    return (
      type === "DEPOSIT" ||
      type === "TRANSFER_IN"
    );
  }

  function transactionIcon(type?: string) {
    switch (type) {
      case "DEPOSIT":
        return "↓";

      case "WITHDRAWAL":
        return "↑";

      case "TRANSFER_IN":
        return "↙";

      case "TRANSFER_OUT":
        return "↗";

      default:
        return "₦";
    }
  }

  const customerName = customer
    ? [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(" ")
    : "";

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 pb-24">
        <div className="mx-auto max-w-2xl">
          <p className="text-slate-500">
            Loading transaction history...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-2xl px-4 pt-5">

        <Link
          href="/customer-wallet"
          className="text-sm font-semibold text-emerald-700"
        >
          ← Wallet
        </Link>

        <div className="mb-6 mt-5">
          <p className="text-sm text-slate-500">
            PWFB WALLET
          </p>

          <h1 className="text-2xl font-bold text-slate-900">
            Transaction History
          </h1>

          {customerName && (
            <p className="mt-1 text-sm text-slate-500">
              Account activity for {customerName}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">

          <div className="border-b border-slate-100 p-4">
            <h2 className="font-semibold text-slate-900">
              All Transactions
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Your complete wallet activity
            </p>
          </div>

          {transactions.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
                ₦
              </div>

              <h3 className="mt-4 font-semibold text-slate-800">
                No transactions yet
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Your deposits, withdrawals and transfers
                will appear here.
              </p>

              <Link
                href="/customer-deposit"
                className="mt-5 inline-block rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Make a Deposit
              </Link>
            </div>
          ) : (
            <div>
              {transactions.map((transaction) => {
                const incoming = isIncoming(
                  transaction.type,
                );

                return (
                  <div
                    key={transaction.id}
                    className="border-b border-slate-100 p-4 last:border-b-0"
                  >
                    <div className="flex items-start gap-3">

                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                          incoming
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-orange-50 text-orange-600"
                        }`}
                      >
                        {transactionIcon(
                          transaction.type,
                        )}
                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800">
                              {transactionLabel(
                                transaction.type,
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(
                                transaction.createdAt ||
                                  transaction.created_at,
                              )}
                            </p>
                          </div>

                          <p
                            className={`shrink-0 font-bold ${
                              incoming
                                ? "text-emerald-600"
                                : "text-orange-600"
                            }`}
                          >
                            {incoming ? "+" : "-"}
                            {formatAmount(
                              Number(
                                transaction.amount || 0,
                              ),
                            )}
                          </p>
                        </div>

                        {transaction.description && (
                          <p className="mt-2 text-sm text-slate-600">
                            {transaction.description}
                          </p>
                        )}

                        {transaction.reference && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            Ref: {transaction.reference}
                          </p>
                        )}

                        {transaction.status && (
                          <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium uppercase text-slate-600">
                            {transaction.status}
                          </span>
                        )}

                      </div>
                    </div>
                  </div>
                );
              })}
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
            className="flex flex-col items-center px-2 py-1 text-emerald-600"
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
