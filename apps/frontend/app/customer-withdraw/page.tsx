"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Wallet = { balance?: number; currency?: string };
type Institution = { id: string; name?: string; code?: string };

export default function CustomerWithdrawPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [destination, setDestination] = useState<"BANK" | "ATM">("BANK");
  const [bankQuery, setBankQuery] = useState("");
  const [bankId, setBankId] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
        setCustomerName(String(customer.name || customer.fullName || customer.accountName || "").trim());
        setWallet(await pwfbApi.banking.customerWallet(customer.id));
        setInstitutions(await pwfbApi.banking.institutions() || []);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load withdrawal details.");
      } finally { setLoading(false); }
    }
    load();
  }, [authLoading, user, router]);

  const balance = Number(wallet?.balance || 0);
  const currency = wallet?.currency || "NGN";
  const money = (value: number) => `${currency === "NGN" ? "₦" : `${currency} `}${Number(value || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const filteredBanks = institutions.filter((bank) => `${bank.name || ""} ${bank.code || ""}`.toLowerCase().includes(bankQuery.toLowerCase())).slice(0, 12);

  async function submitWithdrawal() {
    setMessage(""); setSuccess(false);
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setMessage("Enter a valid withdrawal amount greater than zero."); return; }
    if (numericAmount > balance) { setMessage("Insufficient wallet balance."); return; }
    if (destination === "BANK") {
      if (!bankId) { setMessage("Select the bank account receiving the withdrawal."); return; }
      if (!/^\d{10}$/.test(accountNumber.trim())) { setMessage("Enter a valid 10-digit destination account number."); return; }
      if (!accountName.trim()) { setMessage("Enter the destination account name returned by the bank."); return; }
      if (customerName && accountName.trim().toLowerCase() !== customerName.toLowerCase()) { setMessage("Destination account name must match your PWFB account name before an automatic withdrawal can proceed."); return; }
    }
    if (!customerId) { setMessage("Customer account is not available."); return; }
    setSubmitting(true);
    try {
      const bank = institutions.find((item) => item.id === bankId);
      const destinationText = destination === "ATM" ? "ATM withdrawal" : `${bank?.name || "bank"} ${accountNumber}`;
      const result = await pwfbApi.banking.withdraw(customerId, { amount: numericAmount, description: description.trim() || `Automatic ${destinationText} withdrawal`, destination, bankId: destination === "BANK" ? bankId : undefined, accountNumber: destination === "BANK" ? accountNumber : undefined, accountName: destination === "BANK" ? accountName.trim() : undefined });
      setWallet(result?.wallet || wallet);
      setAmount(""); setDescription("");
      setSuccess(true);
      setMessage("Withdrawal submitted successfully. The destination payment will be completed automatically after the payment provider confirms the transfer.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Withdrawal could not be completed.");
    } finally { setSubmitting(false); }
  }

  if (authLoading || loading) return <main className="min-h-screen bg-[#f4faf6] flex items-center justify-center"><p className="font-medium text-emerald-700">Loading withdrawal...</p></main>;

  return (
    <main className="min-h-screen bg-[#f4faf6] pb-24"><div className="mx-auto w-full max-w-2xl px-4 pt-5">
      <Link href="/customer-dashboard" className="inline-flex items-center rounded-full bg-white px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-100">← Back</Link>
      <header className="mt-5 mb-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">PWFB WALLET</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Withdraw</h1><p className="mt-1 text-sm text-slate-500">Send your available wallet balance to your bank or ATM.</p></header>
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-green-500 p-6 text-white shadow-lg"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">Available Balance</p><p className="mt-3 text-4xl font-bold tracking-tight">{money(balance)}</p><p className="mt-2 text-sm text-emerald-100">Amount currently available to withdraw</p></section>
      <section className="mt-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">Withdrawal destination</p><h2 className="mt-1 text-xl font-bold text-slate-900">Where should we send it?</h2>
        <div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={() => setDestination("BANK")} className={`rounded-2xl border p-4 text-left ${destination === "BANK" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}><strong className="block">Bank account</strong><span className="mt-1 block text-xs">Send to your bank</span></button><button type="button" onClick={() => setDestination("ATM")} className={`rounded-2xl border p-4 text-left ${destination === "ATM" ? "border-orange-400 bg-orange-50 text-orange-700" : "border-slate-200 bg-white text-slate-600"}`}><strong className="block">ATM</strong><span className="mt-1 block text-xs">Cash withdrawal</span></button></div>
        {destination === "BANK" && <><label className="mt-5 block text-sm font-semibold text-slate-700">Search bank</label><input value={bankQuery} onChange={(e) => setBankQuery(e.target.value)} placeholder="Search bank name" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50" /><div className="mt-2 max-h-44 overflow-y-auto rounded-2xl border border-slate-100">{filteredBanks.map((bank) => <button key={bank.id} type="button" onClick={() => { setBankId(bank.id); setBankQuery(bank.name || ""); }} className={`block w-full border-b border-slate-100 px-4 py-3 text-left text-sm last:border-0 ${bank.id === bankId ? "bg-emerald-50 font-bold text-emerald-700" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{bank.name || "Unnamed bank"}{bank.code ? <span className="ml-2 text-xs text-slate-400">{bank.code}</span> : null}</button>)}</div><label className="mt-4 block text-sm font-semibold text-slate-700">Account number</label><input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="10-digit account number" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500 focus:bg-white" /><label className="mt-4 block text-sm font-semibold text-slate-700">Account name</label><input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Name returned by bank verification" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500 focus:bg-white" /><div className="mt-3 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">For automatic withdrawal, the verified bank account name must match your PWFB name. A real bank name-enquiry provider should supply this value before money is sent.</div></>}
        {destination === "ATM" && <div className="mt-4 rounded-2xl bg-orange-50 p-4 text-sm leading-6 text-orange-800">ATM withdrawals require an enabled PWFB ATM/payment provider. The wallet will only be debited after the provider confirms the cash withdrawal.</div>}
        <label className="mt-5 block text-sm font-semibold text-slate-700">Amount</label><div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-emerald-500 focus-within:bg-white"><span className="text-lg font-bold text-emerald-600">₦</span><input type="number" min="1" max={balance} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-transparent px-3 py-4 text-xl font-semibold outline-none" /></div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>Available</span><span className="font-semibold text-emerald-700">{money(balance)}</span></div>
        <label className="mt-4 block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span></label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Withdrawal description" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500 focus:bg-white" />
        <button type="button" disabled={submitting} onClick={submitWithdrawal} className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-4 font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">{submitting ? "Processing..." : "Continue Withdrawal"}</button>
        {message && <div className={`mt-4 rounded-2xl p-4 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message}</div>}
      </section>
    </div><nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-100 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2"><Link href="/customer-dashboard" className="flex flex-col items-center px-2 py-1 text-slate-500"><span>⌂</span><span className="text-[10px]">Home</span></Link><Link href="/customer-wallet" className="flex flex-col items-center px-2 py-1 text-slate-500"><span>₦</span><span className="text-[10px]">Wallet</span></Link><Link href="/customer-deposit" className="flex flex-col items-center px-2 py-1 text-slate-500"><span>＋</span><span className="text-[10px]">Deposit</span></Link><Link href="/customer-withdraw" className="flex flex-col items-center px-2 py-1 text-emerald-600"><span>↗</span><span className="text-[10px] font-bold">Withdraw</span></Link><Link href="/customer-more" className="flex flex-col items-center px-2 py-1 text-slate-500"><span>•••</span><span className="text-[10px]">More</span></Link></div></nav></main>
  );
}
