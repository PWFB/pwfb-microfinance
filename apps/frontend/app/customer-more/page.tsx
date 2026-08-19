"use client";

import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

const sections = [
  {
    title: "Money",
    items: [
      {
        href: "/customer-wallet",
        icon: "₦",
        title: "My Wallet",
        description: "Wallet balance and transaction history",
      },
      {
        href: "/customer-savings",
        icon: "💰",
        title: "My Savings",
        description: "Savings balance and savings history",
      },
      {
        href: "/customer-loans",
        icon: "▣",
        title: "My Loans",
        description: "Loans and repayment schedule",
      },
      {
        href: "/customer-transactions",
        icon: "↔",
        title: "Transactions",
        description: "Deposits, withdrawals and transfers",
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        href: "/customer-profile",
        icon: "👤",
        title: "My Profile",
        description: "Personal information and security",
      },
      {
        href: "/customer-notifications",
        icon: "🔔",
        title: "Notifications",
        description: "View your account notifications",
      },
      {
        href: "/customer-settings",
        icon: "⚙",
        title: "Settings",
        description: "Manage your application preferences",
      },
    ],
  },
];

export default function CustomerMorePage() {
  const { logout } = useAuth();

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-5">
        {/* HEADER */}
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">
            Customer Account
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            More
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage your PWFB account and financial services.
          </p>
        </header>

        {/* SECTIONS */}
        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 px-1 text-sm font-semibold text-slate-700">
                {section.title}
              </h2>

              <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                {section.items.map((item, index) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 p-4 transition hover:bg-slate-50 active:bg-slate-100 ${
                      index !== section.items.length - 1
                        ? "border-b border-slate-100"
                        : ""
                    }`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-700">
                      {item.icon}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-900">
                        {item.title}
                      </span>

                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                        {item.description}
                      </span>
                    </span>

                    <span className="text-lg text-slate-300">›</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {/* LOGOUT */}
          <section>
            <h2 className="mb-3 px-1 text-sm font-semibold text-slate-700">
              Session
            </h2>

            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-white p-4 text-left shadow-sm transition hover:bg-red-50 active:bg-red-100"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-lg text-red-600">
                🚪
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-red-600">
                  Logout
                </span>

                <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                  Sign out of your PWFB account
                </span>
              </span>

              <span className="text-lg text-red-200">›</span>
            </button>
          </section>
        </div>
      </div>

      {/* CUSTOMER MOBILE NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-6 px-1 py-2">
          <Link
            href="/customer-dashboard"
            className="flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-slate-500"
          >
            <span className="text-base leading-none">⌂</span>
            <span className="text-[10px] font-medium">Home</span>
          </Link>

          <Link
            href="/customer-deposit"
            className="flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-slate-500"
          >
            <span className="text-base leading-none">₦</span>
            <span className="text-[10px] font-medium">Deposit</span>
          </Link>

          <Link
            href="/customer-withdraw"
            className="flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-slate-500"
          >
            <span className="text-base leading-none">↗</span>
            <span className="text-[10px] font-medium">Withdrawal</span>
          </Link>

          <Link
            href="/customer-savings"
            className="flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-slate-500"
          >
            <span className="text-base leading-none">💰</span>
            <span className="text-[10px] font-medium">Saving</span>
          </Link>

          <Link
            href="/customer-loans"
            className="flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-slate-500"
          >
            <span className="text-base leading-none">▣</span>
            <span className="text-[10px] font-medium">Loan</span>
          </Link>

          <Link
            href="/customer-more"
            className="flex flex-col items-center gap-0.5 rounded-xl bg-emerald-50 px-1 py-1.5 text-emerald-700"
          >
            <span className="text-base leading-none">•••</span>
            <span className="text-[10px] font-bold">More</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
