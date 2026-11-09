"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";

type Item = {
  loanId: string; clientId: string; customerName: string; assignedStaffId?: string | null; assignedStaffName?: string | null;
  branchId?: string | null; branchName?: string | null; installmentNumber: number; dueDate: string;
  amountDue: number; paidAmount: number; outstandingAmount: number;
  status: "PAID" | "NOT_PAID"; overdue: boolean;
};
type Register = {
  date: string; items: Item[]; totalInstallments: number; paidCount: number; unpaidCount: number;
  totalDue: number; totalPaid: number; totalOutstanding: number;
};
const localDate = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const money = (value: number) => new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", maximumFractionDigits: 2,
}).format(Number(value || 0));

export default function DailyRepaymentsPage() {
  const [date, setDate] = useState(() => localDate());
  const [register, setRegister] = useState<Register | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    apiRequest(`/loans/repayments/daily?date=${encodeURIComponent(date)}`)
      .then((response) => {
        const result = response?.data ?? response;
        if (active) setRegister(result as Register);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load the daily repayment register.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl bg-slate-50 px-3 py-5 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-800">LAB MICROFINANCE · LOAN COLLECTIONS</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">Daily Repayment Register</h1>
          <p className="mt-1 text-sm text-slate-600">Installments due for the selected date within your assigned access scope.</p>
        </div>
        <Link href="/repayments" className="rounded-xl border border-emerald-700 bg-white px-4 py-2 text-sm font-bold text-emerald-800">Repayment history</Link>
      </div>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label htmlFor="repayment-date" className="mb-2 block text-sm font-bold text-slate-700">Repayment date</label>
        <input id="repayment-date" type="date" value={date} onChange={(event) => setDate(event.target.value)}
          className="h-11 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900" />
      </section>

      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase text-slate-500">Installments</p><strong className="mt-2 block text-2xl text-slate-900">{loading ? "—" : register?.totalInstallments ?? 0}</strong></div>
        <div className="rounded-2xl border border-emerald-200 bg-white p-4"><p className="text-xs font-bold uppercase text-emerald-700">Paid</p><strong className="mt-2 block text-2xl text-emerald-700">{loading ? "—" : register?.paidCount ?? 0}</strong></div>
        <div className="rounded-2xl border border-rose-200 bg-white p-4"><p className="text-xs font-bold uppercase text-rose-700">Not paid</p><strong className="mt-2 block text-2xl text-rose-700">{loading ? "—" : register?.unpaidCount ?? 0}</strong></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase text-slate-500">Amount due</p><strong className="mt-2 block text-lg text-slate-900">{loading ? "—" : money(register?.totalDue || 0)}</strong></div>
        <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-1"><p className="text-xs font-bold uppercase text-slate-500">Outstanding</p><strong className="mt-2 block text-lg text-slate-900">{loading ? "—" : money(register?.totalOutstanding || 0)}</strong></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4 sm:p-5">
          <div><h2 className="font-extrabold text-slate-900">Scheduled installments</h2><p className="mt-1 text-xs text-slate-500">A payment is green only when the recorded repayment covers the scheduled installment.</p></div>
          {register && <span className="text-xs font-bold text-slate-500">{register.date}</span>}
        </div>
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading repayment records…</p> :
          !register?.items?.length ? <p className="p-8 text-center text-sm text-slate-500">No installments are scheduled for this date within your access scope.</p> :
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
                <th className="px-4 py-3">Client / ID</th><th className="px-4 py-3">Branch / Officer</th><th className="px-4 py-3">Loan</th><th className="px-4 py-3">Installment</th>
                <th className="px-4 py-3">Due</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Outstanding</th><th className="px-4 py-3">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {register.items.map((item) => <tr key={item.loanId + "-" + item.installmentNumber}>
                  <td className="px-4 py-4"><strong className="block text-slate-900">{item.customerName || "Customer"}</strong><span className="text-xs text-slate-500">{item.clientId}</span></td>
                  <td className="px-4 py-4"><strong className="block text-slate-800">{item.branchName || "Branch"}</strong><span className="text-xs text-slate-500">{item.assignedStaffName || item.assignedStaffId || "No assigned officer"}</span></td><td className="px-4 py-4 font-mono text-xs text-slate-700">{item.loanId}</td>
                  <td className="px-4 py-4 text-slate-700">#{item.installmentNumber}</td>
                  <td className="px-4 py-4 font-semibold text-slate-900">{money(item.amountDue)}</td>
                  <td className="px-4 py-4 text-slate-700">{money(item.paidAmount)}</td>
                  <td className="px-4 py-4 text-slate-700">{money(item.outstandingAmount)}</td>
                  <td className="px-4 py-4"><span className={item.status === "PAID" ? "inline-flex rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-800" : "inline-flex rounded-full bg-rose-100 px-3 py-1 font-bold text-rose-800"}>{item.status === "PAID" ? "💚 PAID" : item.overdue ? "♥️ NOT PAID · OVERDUE" : "♥️ NOT PAID"}</span></td>
                </tr>)}
              </tbody>
            </table>
          </div>}
      </section>
    </main>
  );
}
