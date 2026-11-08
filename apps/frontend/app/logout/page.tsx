"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function LogoutPage() {
  const { logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try { await logout(); } finally { setSigningOut(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void handleLogout(); }, 250);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-7 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl text-emerald-700">🚪</div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">PWFB MICROFINANCE</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Sign out</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Your session will be securely ended and you will be returned to the login page.</p>
        <button type="button" onClick={handleLogout} disabled={signingOut} className="mt-6 w-full rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60">
          {signingOut ? "Signing out..." : "Logout"}
        </button>
      </section>
    </main>
  );
}
