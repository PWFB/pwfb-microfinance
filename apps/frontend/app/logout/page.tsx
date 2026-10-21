"use client";

import { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";

export default function LogoutPage() {
  const { logout } = useAuth();

  useEffect(() => {
    logout();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <section className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">↪</div>
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-emerald-700">PWFB MICROFINANCE</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Signing you out</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Your local session tokens are being cleared. You will return to the login page.</p>
      </section>
    </main>
  );
}
