"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import PWFBCompanyBrand from "../../components/PWFBCompanyBrand";
import BankSearchSelect from "../../components/BankSearchSelect";
import { pwfbApi } from "../../lib/pwfb-api";

type Bank = { id?: string; code: string; name: string; shortName?: string; provider?: string };
type BankAccount = { id: string; accountNumber: string; accountName: string; isPrimary?: boolean; verifiedAt?: string | null; institution?: { id?: string; name?: string; shortName?: string; code?: string } };

const navItems = [
  ["/customer-dashboard", "⌂", "Home"], ["/customer-wallet", "₦", "Wallet"],
  ["/customer-deposit", "↓", "Deposit"], ["/customer-withdraw", "↗", "Withdraw"],
  ["/customer-bank-transfer", "↔", "Bank Transfer"], ["/customer-transactions", "≡", "Transactions"],
  ["/customer-savings", "💰", "Savings"], ["/customer-loans", "▣", "Loans"],
  ["/customer-account", "◉", "Account"], ["/customer-more", "•••", "More"],
];

export default function CustomerAccountPage() {
  const { user, loading: authLoading } = useAuth();
  const [customer, setCustomer] = useState<any>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function loadAccounts(customerId: string) {
    const result = await pwfbApi.banking.customerAccounts(customerId);
    setAccounts(Array.isArray(result) ? result : result?.data ?? []);
  }

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role !== "CUSTOMER") return;
    (async () => {
      try {
        setLoading(true); setError("");
        const me = await pwfbApi.customers.me();
        if (!me?.id) throw new Error("Customer account could not be found.");
        setCustomer(me);
        const [bankList] = await Promise.all([
          pwfbApi.banking.institutions(),
          loadAccounts(me.id),
        ]);
        setBanks(Array.isArray(bankList) ? bankList : bankList?.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load your account.");
      } finally { setLoading(false); }
    })();
  }, [authLoading, user]);

  const selectedBank = banks.find((b) => b.code === bankCode);
  const name = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "Customer";
  const email = user?.email || customer?.email || "—";
  const phone = customer?.phone || "—";

  async function verifyAccount() {
    setMessage(""); setError(""); setAccountName("");
    if (!selectedBank?.code) { setError("Select a bank first."); return; }
    if (!/^\d{10}$/.test(accountNumber)) { setError("Enter a valid 10-digit account number."); return; }
    setVerifying(true);
    try {
      const result: any = await pwfbApi.banking.accountName(selectedBank.code, accountNumber);
      const verifiedName = String(result?.accountName || result?.name || result?.data?.accountName || result?.data?.name || "").trim();
      if (!verifiedName) throw new Error("The bank did not return a verified account name.");
      setAccountName(verifiedName);
      setMessage("Bank account name verified.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bank account verification failed.");
    } finally { setVerifying(false); }
  }

  async function attachAccount() {
    setMessage(""); setError("");
    if (!customer?.id) return;
    if (!selectedBank?.code) { setError("Select a supported bank."); return; }
    if (!/^\d{10}$/.test(accountNumber)) { setError("Enter a valid 10-digit account number."); return; }
    if (!accountName.trim()) { setError("Verify the account name before attaching it."); return; }
    setSaving(true);
    try {
      await pwfbApi.banking.addCustomerAccount(customer.id, {
        institutionId: selectedBank.id || selectedBank.code,
        accountNumber,
        accountName: accountName.trim(),
        isPrimary: accounts.length === 0,
        provider: selectedBank.provider,
      });
      await loadAccounts(customer.id);
      setBankCode(""); setAccountNumber(""); setAccountName("");
      setMessage("Verified bank account attached to your PWFB wallet.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to attach this bank account.");
    } finally { setSaving(false); }
  }

  if (authLoading || loading) return <main className="min-h-screen bg-slate-50 p-6"><p className="text-emerald-700">Loading your account...</p></main>;
  if (!user) return <main className="min-h-screen bg-slate-50 p-6"><p>Please sign in first.</p><Link className="font-semibold text-emerald-700" href="/login">Login</Link></main>;

  return <main className="min-h-screen bg-slate-50 pb-10">
    <aside className={`fixed inset-y-0 left-0 z-[70] hidden lg:flex flex-col bg-[#064d25] text-white shadow-xl transition-all duration-300 ${sidebarOpen ? "w-52" : "w-[64px]"}`}>
      <div className={`flex h-16 items-center border-b border-white/10 ${sidebarOpen ? "px-3" : "justify-center px-2"}`}>
        <div className={sidebarOpen ? "block min-w-0 flex-1" : "hidden"}><PWFBCompanyBrand small /></div>
        <button type="button" onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle sidebar" className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lg font-bold hover:bg-white/20">{sidebarOpen ? "‹" : "›"}</button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">{navItems.map(([href, icon, label]) => <Link key={href} href={href} title={!sidebarOpen ? label : undefined} className={`flex items-center rounded-lg py-2.5 transition ${sidebarOpen ? "gap-2 px-2" : "justify-center px-1"} ${href === "/customer-account" ? "bg-white/15 text-white" : "text-emerald-50/80 hover:bg-white/10 hover:text-white"}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-sm">{icon}</span><span className={`overflow-hidden whitespace-nowrap text-xs font-semibold transition-all ${sidebarOpen ? "max-w-[130px] opacity-100" : "max-w-0 opacity-0"}`}>{label}</span></Link>)}</nav>
      <div className={`border-t border-white/10 p-3 ${sidebarOpen ? "block" : "hidden"}`}><p className="text-[10px] text-emerald-100/70">Signed in account</p><p className="mt-1 truncate text-sm font-bold">{name}</p></div>
    </aside>

    <div className={`min-w-0 transition-all duration-300 ${sidebarOpen ? "lg:ml-52" : "lg:ml-[64px]"}`}>
      <header className="sticky top-0 z-40 flex h-14 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
        <button type="button" onClick={() => setSidebarOpen(v => !v)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg text-slate-700 shadow-sm">☰</button>
        <div className="ml-3"><p className="text-[10px] font-semibold text-emerald-700">PWFB CUSTOMER</p><p className="text-sm font-bold text-slate-900">{name}</p></div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 p-5">
        {(error || message) && <div className={`rounded-xl border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold tracking-wide text-emerald-700">ACCOUNT PROFILE</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">{name}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Customer ID</p><p className="mt-1 break-all font-semibold text-slate-800">{customer?.id || "—"}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Email</p><p className="mt-1 break-all font-semibold text-slate-800">{email}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Phone</p><p className="mt-1 font-semibold text-slate-800">{phone}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Branch</p><p className="mt-1 break-all font-semibold text-slate-800">{customer?.branchId || "—"}</p></div>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold tracking-[.14em] text-emerald-700">BANK ACCOUNT ATTACHMENT</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Attach a verified bank account</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">Search your bank, enter the 10-digit account number, verify the bank-returned account name, then attach it for withdrawals and bank transfers.</p>

          <label className="mt-5 block text-sm font-semibold text-slate-700">Bank</label>
          <div className="mt-2"><BankSearchSelect banks={banks.map(b => ({ code: String(b.code || ""), name: String(b.name || ""), shortName: b.shortName || b.name }))} value={bankCode} onChange={(code) => { setBankCode(code); setAccountNumber(""); setAccountName(""); setError(""); setMessage(""); }} placeholder="Search bank by name or code..." /></div>

          <label className="mt-4 block text-sm font-semibold text-slate-700">Account number</label>
          <input value={accountNumber} onChange={e => { setAccountNumber(e.target.value.replace(/\D/g, "").slice(0,10)); setAccountName(""); setError(""); setMessage(""); }} inputMode="numeric" maxLength={10} placeholder="10-digit account number" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-emerald-500 focus:bg-white" />

          <label className="mt-4 block text-sm font-semibold text-slate-700">Verified account name</label>
          <input value={verifying ? "Verifying account name..." : accountName} readOnly placeholder="Verify the account before attaching" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3.5 font-semibold text-slate-800 outline-none" />

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={verifyAccount} disabled={verifying || saving} className="rounded-xl border border-emerald-200 bg-white px-5 py-3 text-sm font-bold text-emerald-700 disabled:opacity-50">{verifying ? "Verifying..." : "Verify account"}</button>
            <button type="button" onClick={attachAccount} disabled={saving || verifying || !accountName} className="rounded-xl bg-[#087534] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "Attaching..." : "Attach to wallet"}</button>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">PWFB stores the verified bank account reference and account name. Card numbers, CVV and ATM PIN are not collected here.</p>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-wide text-emerald-700">ATTACHED ACCOUNTS</p><h2 className="mt-1 text-xl font-bold text-slate-900">Your verified bank accounts</h2></div><Link href="/customer-withdraw" className="rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white">Withdraw</Link></div>
          {accounts.length === 0 ? <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No bank account is attached yet.</div> : <div className="mt-4 space-y-2">{accounts.map(account => <div key={account.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{account.institution?.name || "Bank"}</p><p className="mt-1 text-sm text-slate-600">{account.accountName}</p><p className="mt-1 text-xs text-slate-500">•••• {account.accountNumber.slice(-4)} {account.isPrimary ? "• PRIMARY" : ""}</p></div><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">VERIFIED</span></div></div>)}</div>}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Link href="/customer-wallet" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="font-bold text-slate-900">Wallet</p><p className="mt-1 text-xs text-slate-500">View balance and wallet activity.</p></Link>
          <Link href="/customer-bank-transfer" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="font-bold text-slate-900">Bank Transfer</p><p className="mt-1 text-xs text-slate-500">Send money to a verified destination.</p></Link>
        </section>
      </div>
    </div>
  </main>;
}
