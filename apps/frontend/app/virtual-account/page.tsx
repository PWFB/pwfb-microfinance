"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Account = { id: string; accountNumber?: string | null; accountName?: string | null; institutionName?: string | null; provider?: string | null; status?: string; providerReference?: string | null; failureReason?: string | null; assignedAt?: string | null };

export default function VirtualAccountPage() {
  const { user, loading: authLoading } = useAuth();
  const [customerId, setCustomerId] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function load(id: string) {
    setError("");
    const result = await pwfbApi.banking.customerVirtualAccounts(id);
    const list: Account[] = Array.isArray(result) ? result : result?.data ?? [];
    const selected = list.find((x) => x.status === "ACTIVE" && x.accountNumber) ?? list[0] ?? null;
    setAccount(selected);
    return selected;
  }

  async function retryAssignment() {
    if (!customerId || creating) return;
    setCreating(true);
    setError("");
    try {
      const result = await pwfbApi.banking.ensureCustomerVirtualAccount(customerId);
      const list: Account[] = Array.isArray(result) ? result : result?.data ?? [];
      const selected = list.find((x) => x.status === "ACTIVE" && x.accountNumber) ?? list[0] ?? null;
      if (selected) setAccount(selected);
      else await load(customerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Virtual-account assignment could not be completed. Please retry.");
      await load(customerId).catch(() => undefined);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        setLoading(true);
        const customer = await pwfbApi.customers.me();
        setCustomerId(customer.id);
        let active = await load(customer.id);
        if (!active || active.status === "FAILED") {
          setCreating(true);
          active = (await pwfbApi.banking.ensureCustomerVirtualAccount(customer.id))?.[0] ?? null;
          if (!active) await load(customer.id);
          else setAccount(active);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load virtual account");
      } finally { setCreating(false); setLoading(false); }
    })();
  }, [authLoading, user]);

  const copy = async () => { if (account?.accountNumber) await navigator.clipboard?.writeText(account.accountNumber); };
  const active = account?.status === "ACTIVE" && !!account.accountNumber;

  if (authLoading || loading) return <main className="min-h-screen bg-slate-50 p-6"><p>Loading virtual account...</p></main>;
  return <main className="min-h-screen bg-slate-50 pb-10">
    <header className="sticky top-0 z-10 border-b bg-white px-4 py-4"><div className="mx-auto flex max-w-2xl items-center justify-between"><Link href="/customer-wallet" className="text-sm font-semibold text-emerald-700">← Wallet</Link><h1 className="font-bold text-slate-900">Virtual Account</h1><span className="w-10" /></div></header>
    <div className="mx-auto max-w-2xl px-4 pt-6">
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <section className="rounded-2xl bg-[#064d25] p-6 text-white shadow-lg">
        <div className="flex items-center justify-between"><p className="text-xs font-bold tracking-wider text-emerald-100">PWFB REAL VIRTUAL ACCOUNT</p><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{active ? "ACTIVE" : account?.status || "PENDING"}</span></div>
        <p className="mt-7 text-xs text-emerald-100">Account number</p>
        <p className="mt-1 text-2xl font-black tracking-widest">{account?.accountNumber || "Being assigned"}</p>
        {active && <button onClick={copy} className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-bold text-emerald-800">Copy account number</button>}
      </section>
      <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-bold text-slate-900">Account verification</h2>
        <div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><span className="text-slate-500">Bank</span><b>{account?.institutionName || (account?.provider === "PAYSTACK" ? "Paystack assigned bank" : account?.provider === "FLUTTERWAVE" ? "Flutterwave assigned bank" : "Not assigned yet")}</b></div><div className="flex justify-between gap-4"><span className="text-slate-500">Account name</span><b className="text-right">{account?.accountName || "—"}</b></div><div className="flex justify-between gap-4"><span className="text-slate-500">Provider</span><b>{account?.provider || "Not assigned"}</b></div><div className="flex justify-between gap-4"><span className="text-slate-500">Status</span><b className={active ? "text-emerald-700" : "text-amber-700"}>{active ? "Verified / Active" : account?.status || "Pending"}</b></div></div>
        {account?.failureReason && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{account.failureReason}</p>}
        {!active && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">{account?.status === "FAILED" ? "Account assignment needs attention" : "Account assignment is not complete"}</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">No account number will be shown until the provider returns one and PWFB saves the assignment. Retrying reuses the existing PWFB request where possible.</p>
          <button type="button" onClick={retryAssignment} disabled={creating || !customerId} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{creating ? "Checking assignment…" : "Retry account assignment"}</button>
        </div>}
      </section>
      <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">How to fund your wallet</h2><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600"><li>Transfer money from your bank to the virtual account number above.</li><li>Use the displayed account name and bank details exactly.</li><li>Wait for the displayed account provider to confirm the incoming payment.</li><li>PWFB should credit the wallet only after a verified provider notification is processed.</li></ol></section>
      <div className="mt-5 grid grid-cols-2 gap-3"><Link href="/banking?operation=cash-withdraw" className="rounded-xl bg-emerald-600 p-4 text-center font-bold text-white">Withdraw</Link><Link href="/banking?operation=transfer" className="rounded-xl border bg-white p-4 text-center font-bold text-slate-800">Transfer</Link></div>
      {creating && <p className="mt-4 text-center text-sm text-slate-500">Requesting or checking your virtual-account assignment with the configured provider…</p>}
    </div>
  </main>;
}
