"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";

type Charge = { chargeKey: string; name: string; amount: number; currency: string; active: boolean; updatedAt?: string };
type Change = { id: string; previousAmount?: number | null; newAmount: number; currency: string; actorEmail?: string; note?: string; createdAt: string };

const money = (amount: number, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount) || 0);

export default function ChargesPage() {
  const [charge, setCharge] = useState<Charge | null>(null);
  const [history, setHistory] = useState<Change[]>([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const [charges, changes] = await Promise.all([
        apiRequest("/charges"),
        apiRequest("/charges/client-registration/history"),
      ]);
      const rows = Array.isArray(charges) ? charges : [];
      const current = rows.find((row: any) => row.chargeKey === "CLIENT_REGISTRATION") || null;
      setCharge(current);
      setAmount(current ? String(current.amount) : "");
      setHistory(Array.isArray(changes) ? changes : []);
    } catch (e: any) {
      setError(e?.message || "Only Super Admin can view the charge change history.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { setError("Enter a valid positive NGN charge."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const updated = await apiRequest("/charges/client-registration", {
        method: "PATCH",
        body: JSON.stringify({ amount: value, note }),
      });
      setMessage(\`Client registration fee updated to \${money(value)}. Existing receipts are unchanged.\`);
      setNote("");
      await load();
      setCharge((current) => current ? { ...current, amount: Number(updated.amount), updatedAt: updated.updatedAt } : current);
    } catch (e: any) {
      setError(e?.message || "Unable to update charge. Only Super Admin can change this setting.");
    } finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-slate-50 p-4 text-slate-800 md:p-8">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-emerald-900 p-6 text-white">
        <div><p className="text-xs font-black tracking-widest text-orange-300">SUPER ADMIN · CENTRAL CHARGE REGISTER</p><h1 className="mt-2 text-3xl font-black">Charges & Fees</h1><p className="mt-1 text-sm text-emerald-100">One central place to manage approved PWFB charges and preserve every change.</p></div>
        <Link href="/dashboard" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold">Dashboard</Link>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">Client registration fee</h2><p className="mt-1 text-sm text-slate-500">Applied to new client registrations only. Historical receipts keep the amount collected at the time.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{charge?.active ? "ACTIVE" : "INACTIVE"}</span></div>
        {loading ? <p className="mt-5 text-sm text-slate-500">Loading central charge setting…</p> : <div className="mt-5 grid gap-4 md:grid-cols-[1fr_2fr]">
          <div className="rounded-xl bg-slate-50 p-5"><p className="text-xs font-bold text-slate-500">CURRENT APPROVED AMOUNT</p><strong className="mt-2 block text-3xl text-emerald-900">{charge ? money(charge.amount, charge.currency) : "Unavailable"}</strong><p className="mt-2 text-xs text-slate-500">Charge key: CLIENT_REGISTRATION</p></div>
          <div className="space-y-3">
            <label className="block text-sm font-bold">New registration fee (NGN)<input type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-bold" /></label>
            <label className="block text-sm font-bold">Change reason<input value={note} onChange={e=>setNote(e.target.value)} maxLength={500} placeholder="Reason for changing the approved charge" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-normal" /></label>
            <button type="button" disabled={saving || loading || !amount.trim()} onClick={save} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "Saving…" : "Save central charge"}</button>
            <p className="text-xs text-slate-500">Backend permission is Super Admin only. Each successful change creates an append-only history record.</p>
          </div>
        </div>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">Charge change history</h2><p className="mt-1 text-sm text-slate-500">Every change includes the previous amount, new amount, actor, reason and timestamp.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="p-3">Changed at</th><th className="p-3">Previous</th><th className="p-3">New amount</th><th className="p-3">Changed by</th><th className="p-3">Reason</th></tr></thead><tbody>
          {history.map(item=><tr key={item.id} className="border-t border-slate-100"><td className="p-3">{new Date(item.createdAt).toLocaleString("en-NG")}</td><td className="p-3">{item.previousAmount===null||item.previousAmount===undefined?"Initial setting":money(item.previousAmount,item.currency)}</td><td className="p-3 font-bold">{money(item.newAmount,item.currency)}</td><td className="p-3">{item.actorEmail||item.actorId||"System"}</td><td className="p-3">{item.note||"—"}</td></tr>)}
          {!loading && history.length===0 && <tr><td className="p-4 text-center text-slate-500" colSpan={5}>No charge changes have been recorded yet.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  </main>;
}
