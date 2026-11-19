"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { pwfbApi } from "../../lib/pwfb-api";

type Customer = { id: string; firstName?: string; lastName?: string; email?: string; phone?: string };
type Transaction = {
  id: string;
  type?: string;
  amount?: number;
  description?: string;
  reference?: string;
  status?: string;
  source?: string;
  createdAt?: string;
  created_at?: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] || char);
}

function transactionTime(transaction: Transaction): Date | null {
  const raw = transaction.createdAt || transaction.created_at;
  if (!raw) return null;
  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? null : value;
}

function transactionType(value?: string): string {
  const normalized = String(value || "TRANSACTION").trim().toUpperCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    DEPOSIT: "Deposit",
    WITHDRAWAL: "Withdrawal",
    TRANSFER_IN: "Transfer Received",
    TRANSFER_OUT: "Transfer Sent",
    SAVINGS_DEPOSIT: "Savings Deposit",
    SAVINGS_WITHDRAWAL: "Savings Withdrawal",
  };
  return labels[normalized] || normalized.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isIncoming(transaction: Transaction): boolean {
  return ["DEPOSIT", "TRANSFER_IN", "SAVINGS_DEPOSIT"].includes(
    String(transaction.type || "").trim().toUpperCase().replace(/[\s-]+/g, "_"),
  );
}

function makePrintDocument(title: string, customer: Customer | null, rows: Transaction[], rangeLabel: string): string {
  const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : "Customer";
  const money = (amount: number) => "₦" + Number(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const date = (value: Date | null) => value ? value.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable";
  const body = rows.map((item) => {
    const time = transactionTime(item);
    const incoming = isIncoming(item);
    return `<tr><td>${escapeHtml(date(time))}</td><td>${escapeHtml(transactionType(item.type))}</td><td>${escapeHtml(item.reference || "Not provided")}</td><td>${escapeHtml(item.description || "—")}</td><td class="amount ${incoming ? "in" : "out"}">${incoming ? "+" : "−"}${escapeHtml(money(Number(item.amount || 0)))}</td><td>${escapeHtml(item.status || "Recorded")}</td></tr>`;
  }).join("");
  const totalIn = rows.filter(isIncoming).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalOut = rows.filter((item) => !isIncoming(item)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    *{box-sizing:border-box}body{font:13px Arial,sans-serif;color:#17251d;margin:32px}
    header{border-bottom:4px solid #087b45;padding-bottom:14px;margin-bottom:22px}
    h1{font-size:22px;margin:0 0 6px}p{margin:4px 0;color:#55645b}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0}
    .summary{display:flex;gap:12px;margin:18px 0}.summary div{border:1px solid #dce7df;border-radius:8px;padding:12px;min-width:180px}
    .summary strong{display:block;margin-top:5px;font-size:16px}
    table{border-collapse:collapse;width:100%;margin-top:14px}th,td{border-bottom:1px solid #dce5de;padding:9px 7px;text-align:left;vertical-align:top}
    th{background:#f1f7f3;font-size:11px;text-transform:uppercase}.amount{white-space:nowrap;font-weight:bold}.in{color:#087b45}.out{color:#c45b16}
    footer{margin-top:28px;border-top:1px solid #dce5de;padding-top:12px;color:#64736a;font-size:10px}
    @media print{body{margin:12mm}button{display:none}}
  </style></head><body>
    <header><h1>PWFB Microfinance</h1><p>${escapeHtml(title)}</p></header>
    <div class="meta"><p><b>Customer:</b> ${escapeHtml(customerName)}</p><p><b>Client ID:</b> ${escapeHtml(customer?.id || "Not available")}</p><p><b>Period:</b> ${escapeHtml(rangeLabel)}</p><p><b>Printed:</b> ${escapeHtml(new Date().toLocaleString("en-NG"))}</p></div>
    <div class="summary"><div>Money In<strong>${escapeHtml(money(totalIn))}</strong></div><div>Money Out<strong>${escapeHtml(money(totalOut))}</strong></div><div>Transactions<strong>${rows.length}</strong></div></div>
    <table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>${body || '<tr><td colspan="6">No transactions in this period.</td></tr>'}</tbody></table>
    <footer>Keep this statement for your records. References and transaction values are reproduced from the PWFB transaction ledger.</footer>
    <script>window.addEventListener("load",function(){window.print();});</script>
  </body></html>`;
}

export default function CustomerTransactionsPage() {
  const { user, loading: authLoading } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    async function loadTransactions() {
      try {
        setLoading(true); setError("");
        const customerData = await pwfbApi.customers.me();
        setCustomer(customerData);
        const data = await pwfbApi.banking.customerTransactions(customerData.id);
        setTransactions(Array.isArray(data) ? data : data?.data ?? []);
      } catch (err) {
        console.error("Customer transactions load failed:", err);
        setError(err instanceof Error ? err.message : "Unable to load your transactions.");
      } finally { setLoading(false); }
    }
    loadTransactions();
  }, [authLoading, user]);

  const money = (amount: number) => `₦${Number(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = (value?: string) => {
    if (!value) return "Date unavailable";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "Date unavailable" : d.toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : "";
  const rangeError = Boolean(startDate && endDate && startDate > endDate);
  const filteredTransactions = useMemo(() => {
    if (rangeError) return [];
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
    return transactions.filter((transaction) => {
      const timestamp = transactionTime(transaction);
      if (!timestamp) return !start && !end;
      return (!start || timestamp >= start) && (!end || timestamp <= end);
    }).sort((a, b) => (transactionTime(b)?.getTime() || 0) - (transactionTime(a)?.getTime() || 0));
  }, [transactions, startDate, endDate, rangeError]);
  const totalIncoming = filteredTransactions.filter(isIncoming).reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const totalOutgoing = filteredTransactions.filter((transaction) => !isIncoming(transaction)).reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const rangeLabel = startDate || endDate ? `${startDate || "Beginning"} to ${endDate || "Today"}` : "All available dates";

  function openPrintWindow(title: string, rows: Transaction[]) {
    const popup = window.open("", "_blank", "width=900,height=720");
    if (!popup) {
      setError("Your browser blocked the print window. Allow pop-ups for this PWFB site and try again.");
      return;
    }
    popup.document.open();
    popup.document.write(makePrintDocument(title, customer, rows, rangeLabel));
    popup.document.close();
    popup.focus();
  }

  function printReceipt(transaction: Transaction) {
    openPrintWindow("Transaction Receipt", [transaction]);
  }

  function printStatement() {
    openPrintWindow("Customer Transaction Statement", filteredTransactions);
  }

  function downloadStatement() {
    const columns = ["Customer ID", "Customer Name", "Transaction Date", "Type", "Reference", "Description", "Amount", "Status", "Source"];
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = filteredTransactions.map((transaction) => [
      customer?.id || "", customerName, transactionTime(transaction)?.toISOString() || "",
      transactionType(transaction.type), transaction.reference || "", transaction.description || "",
      Number(transaction.amount || 0).toFixed(2), transaction.status || "Recorded", transaction.source || "",
    ]);
    const csv = [columns, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `PWFB-transaction-statement-${startDate || "all"}-to-${endDate || "all"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  if (authLoading || loading) return <main className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-emerald-700">Loading transaction history...</p></main>;

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-2xl px-4 pt-5">
        <Link href="/customer-wallet" className="text-sm font-semibold text-emerald-700 print:hidden">← Wallet</Link>
        <div className="mb-6 mt-5">
          <p className="text-xs font-bold tracking-wider text-emerald-700">PWFB WALLET & SAVINGS</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Transaction History & Receipts</h1>
          {customerName && <p className="mt-1 text-sm text-slate-500">Account activity for {customerName} · Client ID: {customer?.id}</p>}
        </div>

        {error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 print:hidden">{error}</div>}
        {rangeError && <p role="alert" className="mb-4 text-sm font-medium text-red-600 print:hidden">Start date must be on or before the end date.</p>}

        <section className="mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm print:hidden">
          <h2 className="font-semibold text-slate-900">Choose statement period</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">Start date<input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900" /></label>
            <label className="text-xs font-medium text-slate-600">End date<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900" /></label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setStartDate(""); setEndDate(""); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700">Clear dates</button>
            <button type="button" onClick={printStatement} disabled={rangeError} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">Print / Save statement as PDF</button>
            <button type="button" onClick={downloadStatement} disabled={rangeError || !filteredTransactions.length} className="rounded-xl border border-emerald-700 px-4 py-2.5 text-xs font-semibold text-emerald-800 disabled:opacity-40">Download CSV</button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">The date range filters the records before printing or downloading. Use your browser's print dialog to print or save the statement as a PDF.</p>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-emerald-700 p-4 text-white shadow-sm"><p className="text-xs text-emerald-100">Money In</p><p className="mt-1 text-lg font-bold">{money(totalIncoming)}</p></div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Money Out</p><p className="mt-1 text-lg font-bold text-orange-600">{money(totalOutgoing)}</p></div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-900">Transactions in selected period</h2><p className="mt-1 text-xs text-slate-500">{filteredTransactions.length} record(s) · {rangeLabel}</p></div>
          {!filteredTransactions.length ? (
            <div className="p-10 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">₦</div><h3 className="mt-4 font-semibold text-slate-800">No transactions in this period</h3><p className="mt-1 text-sm text-slate-500">Try another date range or clear the dates to view all available transactions.</p><Link href="/customer-deposit" className="mt-5 inline-block rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white print:hidden">Make a Deposit</Link></div>
          ) : filteredTransactions.map((transaction) => {
            const isIn = isIncoming(transaction);
            return <div key={transaction.id} className="border-b border-slate-100 p-4 last:border-b-0">
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold ${isIn ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"}`}>{isIn ? "↓" : "↑"}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">{transactionType(transaction.type)}</p><p className="mt-1 text-xs text-slate-500">{date(transaction.createdAt || transaction.created_at)}</p></div><p className={`shrink-0 font-bold ${isIn ? "text-emerald-600" : "text-orange-600"}`}>{isIn ? "+" : "−"}{money(Number(transaction.amount || 0))}</p></div>
                  {transaction.description && <p className="mt-2 text-sm text-slate-600">{transaction.description}</p>}
                  <p className="mt-1 break-all text-[11px] text-slate-400">Ref: {transaction.reference || "Reference not available"}</p>
                  {transaction.status && <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium uppercase text-slate-600">{transaction.status}</span>}
                  <div className="mt-3 print:hidden"><button type="button" onClick={() => printReceipt(transaction)} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-800">Print receipt / Save as PDF</button></div>
                </div>
              </div>
            </div>;
          })}
        </section>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white print:hidden"><div className="mx-auto flex max-w-2xl items-center justify-around px-1 py-2">
        <Link href="/customer-dashboard" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">⌂</span><span className="text-[10px]">Home</span></Link>
        <Link href="/customer-wallet" className="flex flex-col items-center px-2 py-1 text-emerald-600"><span className="text-lg">₦</span><span className="text-[10px] font-semibold">Wallet</span></Link>
        <Link href="/customer-savings" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">💰</span><span className="text-[10px]">Saving</span></Link>
        <Link href="/customer-loans" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">▣</span><span className="text-[10px]">Loan</span></Link>
        <Link href="/customer-more" className="flex flex-col items-center px-2 py-1 text-slate-600"><span className="text-lg">•••</span><span className="text-[10px]">More</span></Link>
      </div></nav>
    </main>
  );
}
