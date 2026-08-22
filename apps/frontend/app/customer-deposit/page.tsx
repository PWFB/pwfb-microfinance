"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Wallet = { balance?: number; currency?: string };
type Institution = { id: string; name?: string; code?: string };
type VirtualAccount = {
  id: string;
  customerId: string;
  institutionId: string | null;
  institutionName: string | null;
  institutionShortName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  provider: string | null;
  providerReference: string | null;
  status: "PENDING" | "ACTIVE" | "FAILED" | "INACTIVE";
  requestedAt: string;
  assignedAt: string | null;
  failureReason: string | null;
};

export default function CustomerDepositPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [customerId, setCustomerId] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [bankQuery, setBankQuery] = useState("");
  const [bankId, setBankId] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [virtualAccounts, setVirtualAccounts] = useState<VirtualAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingAccount, setRefreshingAccount] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    if (user.role !== "CUSTOMER") { router.replace("/dashboard"); return; }

    async function load() {
      try {
        const customer = await pwfbApi.customers.me();
        if (!customer?.id) throw new Error("Customer account could not be found.");
        setCustomerId(customer.id);
        setWallet(await pwfbApi.banking.customerWallet(customer.id));
        setInstitutions(await pwfbApi.banking.institutions() || []);
        setVirtualAccounts(await pwfbApi.banking.customerVirtualAccounts(customer.id) || []);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load deposit details.");
      } finally { setLoading(false); }
    }
    load();
  }, [authLoading, user, router]);

  const balance = Number(wallet?.balance || 0);
  const currency = wallet?.currency || "NGN";
  const money = (value: number) => `${currency === "NGN" ? "₦" : `${currency} `}${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const filteredBanks = institutions.filter((bank) => `${bank.name || ""} ${bank.code || ""}`.toLowerCase().includes(bankQuery.toLowerCase())).slice(0, 12);
  const latestVirtualAccount = virtualAccounts[0] ?? null;
  const hasPendingAccount = virtualAccounts.some((account) => account.status === "PENDING");

  async function refreshVirtualAccounts(showSpinner = true) {
    if (!customerId) return [];
    if (showSpinner) setRefreshingAccount(true);
    try {
      const accounts = await pwfbApi.banking.customerVirtualAccounts(customerId) || [];
      setVirtualAccounts(accounts);
      return accounts;
    } finally {
      if (showSpinner) setRefreshingAccount(false);
    }
  }

  useEffect(() => {
    if (!customerId || !hasPendingAccount) return;

    const poll = window.setInterval(async () => {
      try {
        const accounts = await refreshVirtualAccounts(false);
        const current = accounts[0];
        if (current?.status === "ACTIVE") {
          setSuccess(true);
          setMessage("Your PWFB funding account is now ready. You can transfer funds to the assigned account below.");
        } else if (current?.status === "FAILED") {
          setSuccess(false);
          setMessage(current.failureReason || "The funding account request could not be completed.");
        }
      } catch (error) {
        console.error("Virtual account refresh failed:", error);
      }
    }, 5000);

    return () => window.clearInterval(poll);
  }, [customerId, hasPendingAccount]);

  async function continueDeposit() {
    setMessage("");
    setSuccess(false);

    const numericAmount = Number(amount);

    if (!bankId) {
      setMessage("Select the bank you will use to fund your PWFB wallet.");
      return;
    }

    if (accountNumber.trim().length !== 10 || !/^\d+$/.test(accountNumber.trim())) {
      setMessage("Enter a valid 10-digit bank account number.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage("Enter a valid deposit amount greater than zero.");
      return;
    }

    if (!customerId) {
      setMessage("Customer account is not available.");
      return;
    }

    setSubmitting(true);

    try {
      const accounts = await pwfbApi.banking.ensureCustomerVirtualAccount(customerId, bankId);
      setVirtualAccounts(accounts || []);
      const account = accounts?.[0];

      setSuccess(true);
      setMessage(
        account?.status === "ACTIVE"
          ? "Your PWFB funding account is ready. Transfer funds to the assigned account below."
          : "Your PWFB funding account request has been prepared. We are waiting for the payment provider to assign the destination account.",
      );
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : "Unable to prepare your PWFB funding account.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) return <main className="min-h-screen bg-[#f4faf6] flex items-center justify-center"><p className="font-medium text-emerald-700">Loading deposit...</p></main>;

  return (
    <main className="min-h-screen bg-[#f4faf6] pb-24"><div className="mx-auto w-full max-w-2xl px-4 pt-5">
      <Link href="/customer-dashboard" className="inline-flex items-center rounded-full bg-white px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-100">← Back</Link>
      <header className="mt-5 mb-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">PWFB WALLET</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Deposit</h1><p className="mt-1 text-sm text-slate-500">Fund your wallet from your bank account.</p></header>
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-green-500 p-6 text-white shadow-lg"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">Available Balance</p><p className="mt-3 text-4xl font-bold tracking-tight">{money(balance)}</p><p className="mt-2 text-sm text-emerald-100">Current balance in your PWFB wallet</p></section>

      <section className="mt-5 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">Funding account</p><h2 className="mt-1 text-xl font-bold text-slate-900">Your PWFB destination account</h2></div>
          <button type="button" onClick={() => refreshVirtualAccounts()} disabled={refreshingAccount || !customerId} className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50">{refreshingAccount ? "Checking..." : "Refresh"}</button>
        </div>

        {latestVirtualAccount ? (
          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-600">Status</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${latestVirtualAccount.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : latestVirtualAccount.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>{latestVirtualAccount.status}</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs text-slate-400">Bank</p><p className="mt-1 font-bold text-slate-900">{latestVirtualAccount.institutionName || "Payment provider"}</p></div>
              <div><p className="text-xs text-slate-400">Account name</p><p className="mt-1 font-bold text-slate-900">{latestVirtualAccount.accountName || "Waiting for assignment"}</p></div>
              <div className="sm:col-span-2"><p className="text-xs text-slate-400">Account number</p><p className="mt-1 text-2xl font-black tracking-wider text-emerald-700">{latestVirtualAccount.accountNumber || "Waiting for provider assignment"}</p></div>
            </div>
            {latestVirtualAccount.status === "PENDING" && <p className="mt-4 text-sm leading-6 text-orange-700">Your account request is pending. This page checks automatically every 5 seconds and will show the assigned account when the payment provider responds.</p>}
            {latestVirtualAccount.status === "FAILED" && <p className="mt-4 text-sm leading-6 text-red-700">{latestVirtualAccount.failureReason || "The provider could not assign a funding account."}</p>}
            {latestVirtualAccount.status === "ACTIVE" && <p className="mt-4 text-sm leading-6 text-emerald-700">Transfer funds to this account. Once the provider confirms the incoming payment, your PWFB wallet will be credited.</p>}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">No PWFB funding account request exists yet. Select your bank and continue below to prepare one.</div>
        )}
      </section>

      <section className="mt-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">Bank funding</p><h2 className="mt-1 text-xl font-bold text-slate-900">Where are you sending from?</h2>
        <label className="mt-5 block text-sm font-semibold text-slate-700">Search your bank</label><input value={bankQuery} onChange={(e) => setBankQuery(e.target.value)} placeholder="Search OPay, PalmPay, FirstBank..." className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50" />
        <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-slate-100">{filteredBanks.length ? filteredBanks.map((bank) => <button key={bank.id} type="button" onClick={() => { setBankId(bank.id); setBankQuery(bank.name || ""); }} className={`block w-full border-b border-slate-100 px-4 py-3 text-left text-sm last:border-0 ${bank.id === bankId ? "bg-emerald-50 font-bold text-emerald-700" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{bank.name || "Unnamed bank"}{bank.code ? <span className="ml-2 text-xs text-slate-400">{bank.code}</span> : null}</button>) : <p className="px-4 py-3 text-sm text-slate-500">No matching bank found.</p>}</div>
        <label className="mt-4 block text-sm font-semibold text-slate-700">Your funding account number</label><input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="10-digit account number" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50" />
        <label className="mt-4 block text-sm font-semibold text-slate-700">Amount</label><div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-emerald-500 focus-within:bg-white"><span className="text-lg font-bold text-emerald-600">₦</span><input type="number" min="1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-transparent px-3 py-4 text-xl font-semibold outline-none" /></div>
        <label className="mt-4 block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span></label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deposit description" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500 focus:bg-white" />
        <button type="button" disabled={submitting} onClick={continueDeposit} className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-4 font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">{submitting ? "Preparing..." : "Prepare PWFB Funding Account"}</button>
        {message && <div className={`mt-4 rounded-2xl p-4 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message}</div>}
      </section>
    </div><nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-100 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2"><Link href="/customer-dashboard" className="flex flex-col items-center px-2 py-1 text-slate-500"><span>⌂</span><span className="text-[10px]">Home</span></Link><Link href="/customer-deposit" className="flex flex-col items-center px-2 py-1 text-emerald-600"><span>₦</span><span className="text-[10px] font-bold">Deposit</span></Link><Link href="/customer-withdraw" className="flex flex-col items-center px-2 py-1 text-slate-500"><span>↗</span><span className="text-[10px]">Withdraw</span></Link><Link href="/customer-savings" className="flex flex-col items-center px-2 py-1 text-slate-500"><span>💰</span><span className="text-[10px]">Saving</span></Link><Link href="/customer-loans" className="flex flex-col items-center px-2 py-1 text-slate-500"><span>▣</span><span className="text-[10px]">Loan</span></Link><Link href="/customer-more" className="flex flex-col items-center px-2 py-1 text-slate-500"><span>•••</span><span className="text-[10px]">More</span></Link></div></nav></main>
  );
}
