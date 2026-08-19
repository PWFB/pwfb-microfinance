"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Loan = {
  id: string;
  amount?: number;
  principalAmount?: number;
  loanAmount?: number;
  outstandingBalance?: number;
  balance?: number;
  remainingBalance?: number;
  interestRate?: number;
  status?: string;
  createdAt?: string;
};

export default function CustomerLoansPage() {
  const { user, loading: authLoading } = useAuth();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;

    async function loadLoans() {
      try {
        setLoading(true);
        setError("");

        const data = await pwfbApi.customers.me();

        const records = Array.isArray(data?.loans)
          ? data.loans
          : [];

        setLoans(records);
      } catch (err) {
        console.error("Customer loans load failed:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your loans.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadLoans();
  }, [authLoading, user]);

  const borrowed = loans.reduce(
    (total, loan) =>
      total +
      Number(
        loan.amount ??
        loan.principalAmount ??
        loan.loanAmount ??
        0,
      ),
    0,
  );

  const outstanding = loans.reduce(
    (total, loan) =>
      total +
      Number(
        loan.outstandingBalance ??
        loan.balance ??
        loan.remainingBalance ??
        0,
      ),
    0,
  );

  const activeLoans = loans.filter((loan) => {
    const status = (loan.status || "").toLowerCase();

    return (
      status === "active" ||
      status === "approved" ||
      status === "disbursed"
    );
  }).length;

  const money = (value: number) =>
    `₦${Number(value || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-emerald-700">
          Loading your loans...
        </p>
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
            PWFB LOANS
          </p>

          <h1 className="text-2xl font-bold text-slate-900">
            My Loans
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            View your loan applications, balances and repayment status.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* LOAN SUMMARY */}
        <section className="grid grid-cols-2 gap-3">

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Borrowed Loan
            </p>

            <p className="mt-2 text-xl font-bold text-slate-900">
              {money(borrowed)}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Total loan amount
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Loan Balance
            </p>

            <p className="mt-2 text-xl font-bold text-orange-600">
              {money(outstanding)}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Outstanding balance
            </p>
          </div>

        </section>

        <section className="mt-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Active Loans
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {activeLoans}
              </p>
            </div>

            <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              {loans.length} total
            </div>
          </div>
        </section>

        {/* LOAN LIST */}
        <section className="mt-5 space-y-3">

          {loans.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">

              <div className="text-3xl">
                ▣
              </div>

              <h2 className="mt-3 font-semibold text-slate-900">
                No loans yet
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Your loan applications and active loans will appear here.
              </p>

            </div>
          ) : (
            loans.map((loan) => {
              const principal = Number(
                loan.amount ??
                loan.principalAmount ??
                loan.loanAmount ??
                0,
              );

              const balance = Number(
                loan.outstandingBalance ??
                loan.balance ??
                loan.remainingBalance ??
                0,
              );

              const status = loan.status || "Pending";

              return (
                <div
                  key={loan.id}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >

                  <div className="flex items-start justify-between gap-4">

                    <div>
                      <p className="font-semibold text-slate-900">
                        Loan
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        ID: {loan.id}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        status.toLowerCase() === "active" ||
                        status.toLowerCase() === "approved" ||
                        status.toLowerCase() === "disbursed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {status}
                    </span>

                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4">

                    <div>
                      <p className="text-xs text-slate-500">
                        Loan Amount
                      </p>

                      <p className="mt-1 font-bold text-slate-900">
                        {money(principal)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Outstanding
                      </p>

                      <p className="mt-1 font-bold text-orange-600">
                        {money(balance)}
                      </p>
                    </div>

                  </div>

                  {loan.interestRate !== undefined && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <p className="text-xs text-slate-500">
                        Interest Rate
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {loan.interestRate}%
                      </p>
                    </div>
                  )}

                </div>
              );
            })
          )}

        </section>

      </div>

      {/* CUSTOMER NAVIGATION */}
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
            className="flex flex-col items-center px-2 py-1 text-emerald-600"
          >
            <span className="text-lg">▣</span>
            <span className="text-[10px] font-semibold">Loan</span>
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
