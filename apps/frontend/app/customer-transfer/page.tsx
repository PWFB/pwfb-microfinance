"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Wallet = { balance?: number };
type Institution = { id?: string; code?: string; name?: string; bankCode?: string; institutionCode?: string };

export default function CustomerTransferPage() {
  const { user, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    async function load() {
      try {
        setLoading(true);
        const customerId = (user as any).customerId || (user as any).customer?.id;
        if (!customerId) throw new Error("Customer account could not be identified.");
        const [walletData, bankData] = await Promise.all([
          pwfbApi.banking.customerWallet(customerId),
          pwfbApi.banking.institutions(),
        ]);
        setWallet(walletData);
        const list = Array.isArray(bankData) ? bankData : bankData?.data || bankData?.institutions || [];
        setInstitutions(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load transfer details.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, user]);

  const money = (value: number) => `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const balance = Number(wallet?.balance ?? 0);
  const selectedBank = institutions.find((bank) => (bank.code || bank.bankCode || bank.institutionCode) === bankCode);

  async function verifyAccount() {
    setError("");
    setMessage("");
    setAccountName("");
    if (!bankCode) return setError("Select a bank.");
    if (!/^\d{10}$/.test(accountNumber)) return setError("Enter a valid 10-digit account number.");
    try {
      setVerifying(true);
      const result = await pwfbApi.banking.accountName(bankCode, accountNumber);
      const name = result?.accountName || result?.account_name || result?.data?.account_name || result?.data?.accountName;
      if (!name) throw new Error("The bank could not verify this account.");
      setAccountName(String(name));
      setMessage("Account verified successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify account.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const customerId = (user as any)?.customerId || (user as any)?.customer?.id;
    const numericAmount = Number(amount);
    if (!customerId) return setError("Customer account could not be identified.");
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) return setError("Enter and verify a valid bank account.");
    if (!accountName) return setError("Verify the bank account name before transferring.");
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Enter a valid transfer amount greater than zero.");
    if (numericAmount > balance) return setError("Insufficient wallet balance.");
    try {
      setSubmitting(true);
      const result = await pwfbApi.banking.bankTransfer(customerId, {
        bankCode,
        accountNumber,
        accountName,
        amount: numericAmount,
        narration: description.trim() || "PWFB wallet bank transfer",
      });
      setWallet(result?.senderWallet || result?.wallet || wallet);
      setAmount("");
      setDescription("");
      setMessage("Bank transfer submitted successfully.");
    } catch (err) {
      console.error("Bank transfer failed:", err);
      setError(err instanceof Error ? err.message : "Unable to complete bank transfer.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) return <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4"><div className="text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-xl text-emerald-700">₦</div><p className="mt-3 font-medium text-emerald-700">Loading your wallet...</p></div></main>;

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-2xl px-4 pt-5">
        <Link href="/customer-dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">← Dashboard</Link>
        <header className="mt-5 mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">PWFB WALLET</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Bank Transfer</h1><p className="mt-1 text-sm leading-6 text-slate-500">Send money from your PWFB wallet to a Nigerian bank account.</p></header>
        <section className="overflow-hidden rounded-3xl bg-emerald-700 p-6 text-white shadow-sm"><p className="text-sm font-medium text-emerald-100">Available Balance</p><p className="mt-2 text-3xl font-bold tracking-tight">{money(balance)}</p></section>
        {message && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{message}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="mt-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Recipient bank account</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Select the bank and enter the account number. PWFB will verify the account name before you can transfer.</p>
          <label className="mt-5 block text-sm font-semibold text-slate-700">Bank</label>
          <select value={bankCode} onChange={(e) => { setBankCode(e.target.value); setAccountName(""); setMessage(""); }} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100">
            <option value="">Select bank</option>
            {institutions.map((bank, index) => { const code = bank.code || bank.bankCode || bank.institutionCode || ""; return <option key={bank.id || code || index} value={code}>{bank.name || code}</option>; })}
          </select>
          {selectedBank && <p className="mt-2 text-xs text-slate-400">Selected: {selectedBank.name}</p>}
          <label className="mt-5 block text-sm font-semibold text-slate-700">Account Number</label>
          <div className="mt-2 flex gap-2">
            <input value={accountNumber} onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10)); setAccountName(""); setMessage(""); }} placeholder="10-digit account number" inputMode="numeric" maxLength={10} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
            <button type="button" onClick={verifyAccount} disabled={verifying || accountNumber.length !== 10 || !bankCode} className="rounded-2xl bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-50">{verifying ? "Checking..." : "Verify"}</button>
          </div>
          {accountName && <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Verified account name</p><p className="mt-1 text-base font-bold text-emerald-900">{accountName}</p></div>}
          <label className="mt-5 block text-sm font-semibold text-slate-700">Amount</label>
          <div className="relative mt-2"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-slate-400">₦</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-10 pr-4 text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100" /></div>
          <p className="mt-2 text-xs text-slate-400">Maximum available: {money(balance)}</p>
          <label className="mt-5 block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span></label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this transfer for?" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
          <button type="submit" disabled={submitting || balance <= 0 || !accountName} className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-3.5 font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Processing Transfer..." : balance <= 0 ? "No Available Balance" : !accountName ? "Verify Account First" : "Transfer Money"}</button>
        </form>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">Always verify the account name before confirming a bank transfer.</div>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-2xl items-center justify-around px-1 py-2"><Link href="/customer-dashboard" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">⌂</span><span className="text-[10px]">Home</span></Link><Link href="/customer-wallet" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">₦</span><span className="text-[10px]">Wallet</span></Link><Link href="/customer-savings" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">💰</span><span className="text-[10px]">Saving</span></Link><Link href="/customer-loans" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">▣</span><span className="text-[10px]">Loan</span></Link><Link href="/customer-more" className="flex flex-col items-center px-2 py-1 text-emerald-700"><span className="text-lg">•••</span><span className="text-[10px] font-semibold">More</span></Link></div></nav>
    </main>
  );
}
