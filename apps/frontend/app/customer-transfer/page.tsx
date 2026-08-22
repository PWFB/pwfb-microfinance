"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Wallet = { balance?: number };
type Institution = { id: string; name?: string; code?: string };

export default function CustomerTransferPage() {
  const { user, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [recipientCustomerId, setRecipientCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [bankQuery, setBankQuery] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountLookupLoading, setAccountLookupLoading] = useState(false);
  const [accountLookupError, setAccountLookupError] = useState("");
  const [accountVerified, setAccountVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    async function loadWallet() {
      try {
        setLoading(true);
        setError("");
        const customerId = (user as any).customerId || (user as any).customer?.id;
        if (!customerId) throw new Error("Customer account could not be identified.");
        const [data, banks] = await Promise.all([
          pwfbApi.banking.customerWallet(customerId),
          pwfbApi.banking.institutions(),
        ]);
        setWallet(data);
        setInstitutions(banks || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load your wallet.");
      } finally { setLoading(false); }
    }
    loadWallet();
  }, [authLoading, user]);

  useEffect(() => {
    setAccountName("");
    setAccountLookupError("");
    setAccountVerified(false);
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setAccountLookupLoading(true);
        const result = await pwfbApi.banking.accountName(bankCode, accountNumber);
        if (cancelled) return;
        const name = result?.accountName || result?.account_name || result?.name || result?.data?.accountName || result?.data?.account_name;
        if (!name) throw new Error(result?.message || "Account name could not be verified.");
        setAccountName(String(name));
        setAccountVerified(true);
      } catch (err) {
        if (!cancelled) setAccountLookupError(err instanceof Error ? err.message : "Unable to verify account name.");
      } finally {
        if (!cancelled) setAccountLookupLoading(false);
      }
    }, 500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [bankCode, accountNumber]);

  const money = (value: number) => `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const filteredBanks = institutions.filter((bank) => `${bank.name || ""} ${bank.code || ""}`.toLowerCase().includes(bankQuery.toLowerCase())).slice(0, 12);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    const customerId = (user as any)?.customerId || (user as any)?.customer?.id;
    const numericAmount = Number(amount);
    if (!customerId) return setError("Customer account could not be identified.");
    if (!recipientCustomerId.trim()) return setError("Enter the recipient customer ID.");
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Enter a valid transfer amount greater than zero.");
    if (numericAmount > Number(wallet?.balance ?? 0)) return setError("Insufficient wallet balance.");
    try {
      setSubmitting(true);
      const result = await pwfbApi.banking.transfer(customerId, { recipientCustomerId: recipientCustomerId.trim(), amount: numericAmount, description: description.trim() || "Customer wallet transfer" });
      setWallet(result?.senderWallet || wallet); setAmount(""); setDescription(""); setRecipientCustomerId("");
      setMessage("Transfer completed successfully.");
    } catch (err) {
      console.error("Customer transfer failed:", err);
      setError(err instanceof Error ? err.message : "Unable to complete transfer.");
    } finally { setSubmitting(false); }
  }

  if (authLoading || loading) return <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4"><p className="font-medium text-emerald-700">Loading your wallet...</p></main>;
  const balance = Number(wallet?.balance ?? 0);

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-2xl px-4 pt-5">
        <Link href="/customer-dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">← Dashboard</Link>
        <header className="mt-5 mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">PWFB WALLET</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Transfer Money</h1><p className="mt-1 text-sm leading-6 text-slate-500">Verify a bank recipient before a transfer is sent.</p></header>

        <section className="overflow-hidden rounded-3xl bg-emerald-700 p-6 text-white shadow-sm"><p className="text-sm font-medium text-emerald-100">Available Balance</p><p className="mt-2 text-3xl font-bold tracking-tight">{money(balance)}</p><p className="mt-2 text-xs text-emerald-100">Available for transfers.</p></section>

        {message && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{message}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

        <section className="mt-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Bank recipient verification</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Select OPay, PalmPay, FirstBank or another supported institution and enter the recipient account number. PWFB will verify the account name through NIBSS before the bank transfer is allowed.</p>

          <label className="mt-5 block text-sm font-semibold text-slate-700">Search bank</label>
          <input value={bankQuery} onChange={(e) => setBankQuery(e.target.value)} placeholder="Search OPay, PalmPay, FirstBank..." className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
          <div className="mt-2 max-h-44 overflow-y-auto rounded-2xl border border-slate-100">
            {filteredBanks.length ? filteredBanks.map((bank) => <button key={bank.id} type="button" onClick={() => { setBankCode(bank.code || bank.id); setBankQuery(bank.name || ""); }} className={`block w-full border-b border-slate-100 px-4 py-3 text-left text-sm last:border-0 ${bankCode === (bank.code || bank.id) ? "bg-emerald-50 font-bold text-emerald-700" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{bank.name || "Unnamed bank"}{bank.code ? <span className="ml-2 text-xs text-slate-400">{bank.code}</span> : null}</button>) : <p className="px-4 py-3 text-sm text-slate-500">No matching bank found.</p>}
          </div>

          <label className="mt-4 block text-sm font-semibold text-slate-700">Recipient account number</label>
          <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="10-digit account number" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100" />

          <label className="mt-4 block text-sm font-semibold text-slate-700">Verified account name</label>
          <div className={`mt-2 rounded-2xl border px-4 py-3.5 ${accountVerified ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
            {accountLookupLoading ? <span className="text-sm text-slate-500">Verifying account name...</span> : accountLookupError ? <span className="text-sm font-medium text-red-600">{accountLookupError}</span> : accountVerified ? <><span className="font-bold text-emerald-800">{accountName}</span><span className="ml-2 text-xs font-semibold text-emerald-600">✓ Verified</span></> : <span className="text-sm text-slate-400">Enter a valid account number to verify.</span>}
          </div>
        </section>

        <form onSubmit={handleSubmit} className="mt-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">PWFB customer transfer</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Internal PWFB transfers remain available while external bank payout is being connected to the approved payment provider.</p>
          <label className="mt-5 block text-sm font-semibold text-slate-700">Recipient Customer ID</label>
          <input value={recipientCustomerId} onChange={(e) => setRecipientCustomerId(e.target.value)} placeholder="Enter customer ID" autoComplete="off" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
          <label className="mt-5 block text-sm font-semibold text-slate-700">Amount</label>
          <div className="relative mt-2"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-slate-400">₦</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-10 pr-4 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100" /></div>
          <p className="mt-2 text-xs text-slate-400">Maximum available: {money(balance)}</p>
          <label className="mt-5 block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span></label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this transfer for?" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
          <button type="submit" disabled={submitting || balance <= 0} className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Processing Transfer..." : balance <= 0 ? "No Available Balance" : "Transfer Money"}</button>
        </form>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-2xl items-center justify-around px-1 py-2"><Link href="/customer-dashboard" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">⌂</span><span className="text-[10px]">Home</span></Link><Link href="/customer-wallet" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">₦</span><span className="text-[10px]">Wallet</span></Link><Link href="/customer-savings" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">💰</span><span className="text-[10px]">Saving</span></Link><Link href="/customer-loans" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">▣</span><span className="text-[10px]">Loan</span></Link><Link href="/customer-more" className="flex flex-col items-center px-2 py-1 text-emerald-700"><span className="text-lg">•••</span><span className="text-[10px] font-semibold">More</span></Link></div></nav>
    </main>
  );
}
