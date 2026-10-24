"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    else if (!loading && user?.role === "CUSTOMER") router.replace("/customer-dashboard");
  }, [loading, user, router]);

  if (loading || !user || user.role === "CUSTOMER") {
    return <main className="min-h-screen bg-slate-50 p-6"><p className="text-lg font-semibold text-emerald-800">Checking your account...</p></main>;
  }

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "LAB User";

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-base font-bold text-emerald-800">← Back to Dashboard</Link>
        <header className="mt-5 rounded-3xl bg-emerald-900 p-7 sm:p-9 text-white shadow-sm">
          <div className="flex items-center gap-4 sm:gap-6">
            <img src="/pwfb-app-icon.svg" alt="LAB MICROFINANCE logo" className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white p-2" />
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-amber-200">LAB MICROFINANCE</p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">My Profile</h1>
              <p className="mt-2 text-base sm:text-lg text-emerald-100">Empowering Dreams • Building Futures</p>
            </div>
          </div>
        </header>
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {[
            ["Full name", displayName],
            ["Email", user.email || "Not provided"],
            ["Role", user.role.replaceAll("_", " ")],
            ["User ID", user.id || "Not available"],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-2 border-b border-slate-100 p-5 last:border-b-0 sm:grid-cols-[180px_1fr] sm:gap-5 sm:p-6">
              <span className="text-base font-medium text-slate-600">{label}</span>
              <span className="break-all text-base sm:text-lg font-semibold text-slate-900">{value}</span>
            </div>
          ))}
        </section>
        <p className="mt-5 text-base leading-7 text-slate-600">To change account details or access permissions, contact your LAB MICROFINANCE administrator. This page does not modify financial records.</p>
      </div>
    </main>
  );
}
