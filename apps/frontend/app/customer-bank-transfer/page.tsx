"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Bank = { code: string; name: string; shortName?: string };
type Customer = { id: string; firstName?: string; lastName?: string };
type Wallet = { balance?: number; currency?: string };

export default function CustomerBankTransferPage() {
  const { user, loading: authLoading } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankSearch, setBankSearch] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([pwfbApi.customers.me(), pwfbApi.banking.institutions()]).then(async ([c, b]) => {
      setCustomer(c);
      setWallet(await pwfbApi.banking.customerWallet(c.id));
      const list = Array.isArray(b) ? b : b?.data ?? [];
      setBanks(list.map((x: any) => ({ code: String(x.code ?? x.bankCode ?? ""), name: String(x.name ?? x.bankName ?? x.institutionName ?? ""), shortName: x.shortName })).filter((x: Bank) => x.code && x.name));
    }).catch((e) => setMessage(e instanceof Error ? e.message : "Unable to load your bank transfer page."));
  }, [authLoading, user]);

  useEffect(() => {
    setVerified(false); setAccountName("");
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) return;
    let cancelled = false;
    setVerifying(true);
    pwfbApi.banking.accountName(bankCode, accountNumber).then((r: any) => {
      if (!cancelled) { const name = String(r?.accountName ?? r?.data?.accountName ?? "").trim(); setAccountName(name); setVerified(Boolean(name)); }
    }).catch(() => { if (!cancelled) { setAccountName(""); setVerified(false); } }).finally(() => { if (!cancelled) setVerifying(false); });
    return () => { cancelled = true; };
  }, [bankCode, accountNumber]);

  const filteredBanks = useMemo(() => { const q = bankSearch.trim().toLowerCase(); return q ? banks.filter(b => `${b.name} ${b.shortName ?? ""} ${b.code}`.toLowerCase().includes(q)) : banks; }, [banks, bankSearch]);
  const customerName = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ");
  const balance = Number(wallet?.balance || 0);

  async function submit() {
    const n = Number(amount);
    if (!verified) return setMessage("Verify the destination bank account before continuing.");
    if (!Number.isFinite(n) || n <= 0) return setMessage("Enter a valid transfer amount.");
    if (n > balance) return setMessage("Insufficient wallet balance.");
    setLoading(true); setMessage("");
    try {
      if (!customer?.id) throw new Error("Customer account could not be identified. Please sign in again.");
      await pwfbApi.banking.bankTransfer(customer.id, { amount: n, description, bankCode, accountNumber, accountName });
      setWallet(await pwfbApi.banking.customerWallet(customer.id));
      setAmount(""); setDescription(""); setAccountNumber(""); setAccountName(""); setVerified(false);
      setMessage("Bank transfer submitted successfully.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Bank transfer could not be completed."); }
    finally { setLoading(false); }
  }

  if (authLoading) return <main className="min-h-screen bg-slate-50 p-6">Loading...</main>;
  return <main className="min-h-screen bg-slate-50 pb-10"><div className="mx-auto max-w-2xl px-4 py-6">
    <div className="mb-5 flex items-center gap-3"><Link href="/customer-wallet" className="rounded-lg border bg-white px-3 py-2 text-sm">← Wallet</Link><div><p className="text-[10px] font-bold tracking-widest text-emerald-700">PWFB WALLET</p><h1 className="text-2xl font-bold text-slate-900">Bank Transfer</h1></div></div>
    <section className="mb-5 rounded-2xl bg-[#064d25] p-5 text-white shadow-sm"><p className="text-xs text-emerald-100">AVAILABLE BALANCE</p><p className="mt-1 text-3xl font-bold">₦{balance.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p><p className="mt-1 text-xs text-emerald-100">{customerName || "Authenticated PWFB customer"}</p></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Send to bank</h2><p className="mt-1 text-sm text-slate-500">Select the destination bank and verify the account name before sending.</p>
      <div className="mt-5 space-y-4"><div><label className="mb-1 block text-xs font-semibold text-slate-700">Search bank</label><input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-600" value={bankSearch} onChange={e=>setBankSearch(e.target.value)} placeholder="Search Nigerian bank"/></div>
      <div><label className="mb-1 block text-xs font-semibold text-slate-700">Destination bank</label><select className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" value={bankCode} onChange={e=>setBankCode(e.target.value)}><option value="">Select bank</option>{filteredBanks.map(b=><option key={b.code} value={b.code}>{b.name}{b.shortName ? ` (${b.shortName})` : ""}</option>)}</select></div>
      <div><label className="mb-1 block text-xs font-semibold text-slate-700">Account number</label><input inputMode="numeric" maxLength={10} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={accountNumber} onChange={e=>setAccountNumber(e.target.value.replace(/\D/g, "").slice(0,10))} placeholder="10-digit account number"/></div>
      <div className={`rounded-xl border p-4 ${verified ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}><p className="text-xs font-semibold text-slate-500">VERIFIED ACCOUNT NAME</p><p className="mt-1 font-bold text-slate-900">{verifying ? "Verifying account..." : accountName || "Enter account number to verify"}</p>{verified && <p className="mt-1 text-xs font-semibold text-emerald-700">✓ Bank account verified</p>}</div>
      <div><label className="mb-1 block text-xs font-semibold text-slate-700">Amount</label><input type="number" min="1" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="₦0.00"/></div>
      <div><label className="mb-1 block text-xs font-semibold text-slate-700">Narration</label><input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={description} onChange={e=>setDescription(e.target.value)} placeholder="What is this transfer for?"/></div>
      {message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</div>}
      <button type="button" disabled={loading || verifying || !verified} onClick={submit} className="w-full rounded-xl bg-[#087534] px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Sending transfer..." : "Send to bank"}</button>
      </div></section>
  </div></main>;
}
