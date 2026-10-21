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
    return <main className="min-h-screen bg-slate-50 p-6"><p className="text-emerald-700">Checking your account...</p></main>;
  }

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "PWFB User";

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-sm font-semibold text-emerald-700">← Back to Dashboard</Link>
        <header className="mt-5 rounded-3xl bg-emerald-800 p-6 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">PWFB ACCOUNT</p>
          <h1 className="mt-2 text-2xl font-bold">My Profile</h1>
          <p className="mt-1 text-sm text-emerald-100">Your signed-in account details.</p>
        </header>
        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {[
            ["Full name", displayName],
            ["Email", user.email || "Not provided"],
            ["Role", user.role.replaceAll("_", " ")],
            ["User ID", user.id || "Not available"],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 border-b border-slate-100 p-4 last:border-b-0 sm:grid-cols-[160px_1fr] sm:gap-4">
              <span className="text-sm text-slate-500">{label}</span>
              <span className="break-all text-sm font-semibold text-slate-900">{value}</span>
            </div>
          ))}
        </section>
        <p className="mt-4 text-sm text-slate-500">To change account details or access permissions, contact your PWFB administrator. This page does not modify financial records.</p>
      </div>
    </main>
  );
}
