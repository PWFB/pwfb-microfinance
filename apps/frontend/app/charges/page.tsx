"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../lib/api";

type Charge = { key: string; amount: number; currency: string; updatedAt?: string; updatedBy?: string };
type Audit = { id: string; previousAmount: number; newAmount: number; currency: string; reason: string; changedByEmail?: string; createdAt: string };

const money = (amount: number, currency = "NGN") => new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency,
  minimumFractionDigits: 2,
}).format(amount);

export default function ChargesPage() {
  const { user, loading } = useAuth();
  const [charge, setCharge] = useState<Charge | null>(null);
  const [history, setHistory] = useState<Audit[]>([]);
  const [amount, setAmount] = useState("1500");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const isSuperAdmin = String(user?.role || "").toUpperCase() === "SUPER_ADMIN";

  async function load() {
    const [config, audit] = await Promise.all([
      apiRequest("/charges/registration"),
      apiRequest("/charges/registration/audit"),
    ]);
    setCharge(config);
    setAmount(String(config.amount));
    setHistory(Array.isArray(audit) ? audit : []);
  }

  useEffect(() => {
    if (!loading && user && isSuperAdmin) {
      load().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load charge settings."));
    }
  }, [loading, user, isSuperAdmin]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage("Enter a valid registration charge greater than zero.");
      return;
    }
    if (reason.trim().length < 8) {
      setMessage("Enter a reason of at least 8 characters for the audit history.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await apiRequest("/charges/registration", {
        method: "PATCH",
        body: JSON.stringify({ amount: numericAmount, reason: reason.trim() }),
      });
      setMessage(`Registration charge updated from ${money(Number(result.previousAmount), result.currency)} to ${money(Number(result.amount), result.currency)}. The change is recorded in the audit history.`);
      setReason("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update the registration charge.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-6">Loading charge access…</main>;
  if (!isSuperAdmin) return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6"><h1 className="text-xl font-bold">Super Admin access required</h1><p className="mt-2 text-slate-600">Only LAB Microfinance Super Admin can change central customer registration charges or view their change history.</p><Link className="mt-4 inline-block font-bold text-emerald-800" href="/dashboard">Return to dashboard</Link></div></main>;

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-7">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-emerald-950 p-6 text-white">
          <div><p className="text-xs font-black tracking-widest text-orange-300">LAB MICROFINANCE · SUPER ADMIN</p><h1 className="mt-2 text-3xl font-black">Central Charges & Fees</h1><p className="mt-2 text-sm text-emerald-100">One central registration charge for every new customer, with a permanent change history.</p></div>
          <Link href="/dashboard" className="rounded-xl border border-white/30 px-4 py-2 font-bold">Dashboard</Link>
        </header>
        {message && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{message}</p>}
        <section className="grid gap-5 md:grid-cols-[.85fr_1.15fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Current registration charge</h2>
            <p className="mt-4 text-3xl font-black text-emerald-900">{charge ? money(charge.amount, charge.currency) : "Loading…"}</p>
            <p className="mt-2 text-sm text-slate-600">The current default is ₦1,500 per client. New receipts preserve the exact amount that was collected, even after a future fee change.</p>
            <p className="mt-3 text-xs text-slate-500">Last change: {charge?.updatedAt ? new Date(charge.updatedAt).toLocaleString("en-NG") : "Default configuration"}</p>
          </div>
          <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Change central fee</h2>
            <label className="mt-4 grid gap-2 text-sm font-semibold">New amount (NGN)
              <input type="number" min="0.01" max="1000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="rounded-xl border border-slate-300 p-3 text-base" required />
            </label>
            <label className="mt-4 grid gap-2 text-sm font-semibold">Reason for change
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} rows={3} className="rounded-xl border border-slate-300 p-3 text-base" placeholder="Explain the approved policy change" required />
            </label>
            <button type="submit" disabled={busy} className="mt-4 rounded-xl bg-orange-600 px-5 py-3 font-black text-white disabled:opacity-50">{busy ? "Saving…" : "Save central charge"}</button>
          </form>
        </section>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Charge change history</h2><p className="text-sm text-slate-600">Every change records the old and new amount, reason, Super Admin and timestamp.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{history.length} records</span></div>
          {!history.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No changes have been recorded. The system is using the default ₦1,500 fee.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Date</th><th className="p-3">Previous</th><th className="p-3">New</th><th className="p-3">Changed by</th><th className="p-3">Reason</th></tr></thead><tbody>{history.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="p-3">{new Date(item.createdAt).toLocaleString("en-NG")}</td><td className="p-3">{money(Number(item.previousAmount), item.currency)}</td><td className="p-3 font-bold">{money(Number(item.newAmount), item.currency)}</td><td className="p-3">{item.changedByEmail || "Super Admin"}</td><td className="p-3">{item.reason}</td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </main>
  );
}
