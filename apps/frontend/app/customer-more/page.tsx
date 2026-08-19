"use client";

import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

export default function CustomerMorePage() {
  const { logout } = useAuth();

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-2xl px-4 pt-5">

        <div className="mb-6">
          <p className="text-sm text-slate-500">CUSTOMER ACCOUNT</p>
          <h1 className="text-2xl font-bold text-slate-900">
            More
          </h1>
        </div>

        <div className="space-y-3">

          <Link
            href="/customer-wallet"
            className="block rounded-2xl bg-white p-4 shadow-sm border border-slate-100"
          >
            <strong>▣ My Wallet</strong>
            <span className="mt-1 block text-sm text-slate-500">
              Wallet overview and transaction history
            </span>
          </Link>

          <Link
            href="/customer-savings"
            className="block rounded-2xl bg-white p-4 shadow-sm border border-slate-100"
          >
            <strong>💰 My Savings</strong>
            <span className="mt-1 block text-sm text-slate-500">
              Savings overview and savings history
            </span>
          </Link>

          <Link
            href="/customer-loans"
            className="block rounded-2xl bg-white p-4 shadow-sm border border-slate-100"
          >
            <strong>▤ My Loans</strong>
            <span className="mt-1 block text-sm text-slate-500">
              Loans, applications and repayment schedule
            </span>
          </Link>

          <Link
            href="/customer-transactions"
            className="block rounded-2xl bg-white p-4 shadow-sm border border-slate-100"
          >
            <strong>↔ Transactions</strong>
            <span className="mt-1 block text-sm text-slate-500">
              Transfers, deposits and withdrawals
            </span>
          </Link>

          <Link
            href="/customer-profile"
            className="block rounded-2xl bg-white p-4 shadow-sm border border-slate-100"
          >
            <strong>👤 My Profile</strong>
            <span className="mt-1 block text-sm text-slate-500">
              Personal information, security and passkeys
            </span>
          </Link>

          <Link
            href="/customer-notifications"
            className="block rounded-2xl bg-white p-4 shadow-sm border border-slate-100"
          >
            <strong>🔔 Notifications</strong>
            <span className="mt-1 block text-sm text-slate-500">
              View your account notifications
            </span>
          </Link>

          <Link
            href="/customer-settings"
            className="block rounded-2xl bg-white p-4 shadow-sm border border-slate-100"
          >
            <strong>⚙ Settings</strong>
            <span className="mt-1 block text-sm text-slate-500">
              Manage your application preferences
            </span>
          </Link>

          <button
            type="button"
            onClick={logout}
            className="w-full rounded-2xl bg-white p-4 text-left shadow-sm border border-red-100"
          >
            <strong className="text-red-600">🚪 Logout</strong>
            <span className="mt-1 block text-sm text-slate-500">
              Sign out of your PWFB account
            </span>
          </button>

        </div>
      </div>

      {/* CUSTOMER APP BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">

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
            className="flex flex-col items-center px-2 py-1 text-emerald-600"
          >
            <span className="text-lg">•••</span>
            <span className="text-[10px] font-semibold">More</span>
          </Link>

        </div>
      </nav>
    </main>
  );
}
