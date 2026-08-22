"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Institution = { id: string; name: string; shortName?: string; code: string; active?: boolean };
type Wallet = { balance?: number };

type Lookup = { accountName?: string; account_name?: string };

export default function CustomerTransferPage() {
  const { user, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [banks, setBanks] = useState<Institution[]>([]);
  const [bankQuery, setBankQuery] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const money = (value: number) => `₦${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    if (authLoading || !user) return;
    const customerId = (user as any).customerId || (user as any).customer?.id;
    if (!customerId) return;
    Promise.all([pwfbApi.banking.customerWallet(customerId), pwfbApi.banking.institutions()])
      .then(([walletData, institutions]) => { setWallet(walletData); setBanks(Array.isArray(institutions) ? institutions : []); })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load transfer options."))
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  useEffect(() => {
    setAccountName("");
    setLookupError("");
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) { setLookupLoading(false); return; }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setLookupLoading(true);
        const result = (await pwfbApi.banking.accountName(bankCode, accountNumber)) as Lookup;
        if (!cancelled) {
          const name = result?.accountName || result?.account_name;
          if (!name) throw new Error("Account name could not be verified.");
          setAccountName(String(name));
        }
      } catch (err) {
        if (!cancelled) setLookupError(err instanceof Error ? err.message : "Unable to verify account name.");
      } finally { if (!cancelled) setLookupLoading(false); }
    }, 500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [bankCode, accountNumber]);

  const filteredBanks = banks.filter((bank) => `${bank.name} ${bank.shortName || ""} ${bank.code}`.toLowerCase().includes(bankQuery.toLowerCase())).slice(0, 12);
  const balance = Number(wallet?.balance ?? 0);

  async function handleBankTransfer() {
    setError(""); setMessage("");
    const customerId = (user as any)?.customerId || (user as any)?.customer?.id;
    const numericAmount = Number(amount);
    if (!customerId) return setError("Customer account could not be identified.");
    if (!bankCode) return setError("Select a bank or payment institution.");
    if (!/^\d{10}$/.test(accountNumber)) return setError("Enter a valid 10-digit account number.");
    if (!accountName || lookupLoading) return setError("Verify the beneficiary account name before transferring.");
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Enter a valid transfer amount greater than zero.");
    if (numericAmount > balance) return setError("Insufficient wallet balance.");

    try {
      setSubmitting(true);
      const result = await pwfbApi.banking.bankTransfer(customerId, {
        bankCode,
        accountNumber,
        accountName,
        amount: numericAmount,
        description: description.trim() || "PWFB bank transfer",
      });
      setWallet(result?.wallet || wallet);
      setAmount(""); setDescription(""); setAccountNumber(""); setAccountName("");
      setMessage("Bank transfer submitted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bank transfer could not be completed.");
    } finally { setSubmitting(false); }
  }

  if (authLoading || loading) return <main className="min-h-screen flex items-center justify-center bg-slate-50"><p className="font-semibold text-emerald-700">Loading your wallet...</p></main>;

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-2xl px-4 pt-5">
        <Link href="/customer-dashboard" className="text-sm font-semibold text-emerald-700">← Dashboard</Link>
        <header className="mt-5 mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">PWFB WALLET</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Send to Bank</h1><p className="mt-1 text-sm leading-6 text-slate-500">Verify the recipient, then send directly to the selected bank account.</p></header>
        <section className="rounded-3xl bg-emerald-700 p-6 text-white"><p className="text-sm text-emerald-100">Available Balance</p><p className="mt-2 text-3xl font-bold">{money(balance)}</p></section>
        {message && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{message}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

        <section className="mt-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Bank recipient</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">OPay, PalmPay, FirstBank and other institutions are selected from PWFB's active bank list.</p>
          <label className="mt-5 block text-sm font-semibold text-slate-700">Search bank</label>
          <input value={bankQuery} onChange={(e) => setBankQuery(e.target.value)} placeholder="Search OPay, PalmPay, FirstBank..." className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500" />
          <div className="mt-2 max-h-44 overflow-y-auto rounded-2xl border border-slate-100">
            {filteredBanks.length ? filteredBanks.map((bank) => <button key={bank.id} type="button" onClick={() => { setBankCode(bank.code); setBankQuery(bank.name); }} className={`block w-full border-b border-slate-100 px-4 py-3 text-left text-sm last:border-0 ${bankCode === bank.code ? "bg-emerald-50 font-bold text-emerald-700" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{bank.name}{bank.shortName ? ` (${bank.shortName})` : ""}</button>) : <p className="px-4 py-3 text-sm text-slate-500">No matching bank found.</p>}
          </div>
          <label className="mt-4 block text-sm font-semibold text-slate-700">Account number</label>
          <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="10-digit account number" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500" />
          <label className="mt-4 block text-sm font-semibold text-slate-700">Verified account name</label>
          <div className={`mt-2 rounded-2xl border px-4 py-3.5 ${accountName ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
            {lookupLoading ? "Verifying account name..." : lookupError ? <span className="text-red-600">{lookupError}</span> : accountName ? <span className="font-bold text-emerald-800">✓ {accountName}</span> : <span className="text-slate-400">Enter an account number to verify.</span>}
          </div>
          <label className="mt-5 block text-sm font-semibold text-slate-700">Amount</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500" />
          <p className="mt-2 text-xs text-slate-400">Maximum available: {money(balance)}</p>
          <label className="mt-5 block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span></label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Transfer narration" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500" />
          <button type="button" onClick={handleBankTransfer} disabled={submitting || lookupLoading || !accountName || balance <= 0} className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-3.5 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Sending..." : "Send Money"}</button>
        </section>
      </div>
    </main>
  );
}
