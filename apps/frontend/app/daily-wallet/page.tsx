"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PWFBCompanyBrand from "../../components/PWFBCompanyBrand";

type Section = { title: string; items: string[] };

const sections: Section[] = [
  { title: "Daily Operations", items: ["Fill Cashbook", "Fill Savings", "Fill Weekly Loan", "Fill Loan", "Fill CO's Savings", "Fill CO's Weekly Loan", "Fill CO's Loan", "Weekly Opening Balance", "Daily Collection", "Savings Summary", "Loan Summary", "Weekly Loan Summary", "Edit Weekly Loan Summary", "Loan Clients", "Bank Details history", "Total Amount Recieved From Branch", "Bank Transaction", "Cash Book"] },
  { title: "Branch & Structure Management", items: ["Delete Branch", "Add Branch", "Add Area", "Add Division", "Add Region", "Move Branch", "Move Area", "Move Division", "Move CO", "Sack staff"] },
  { title: "Staff & CO Management", items: ["View Staffs", "Add Staff", "Add CO", "Sack CO"] },
  { title: "Editing & Corrections", items: ["Edit Cashbook", "Edit Bank Transaction", "Edit Expenses", "Edit Daily Collection", "Edit Loan Disbursement", "Edit Saving Summary", "Edit Loan Summary", "Edit Finance Service", "Edit CO's Saving Summary", "Edit CO's Loan Summary", "Edit CO's Weekly Loan Summary"] },
  { title: "CEO & Communication", items: ["CEO Monthly", "CEO Collector", "My Inbox 0", "Compose Mail NEW!", "Sent Mail"] },
  { title: "Maintenance", items: ["Delete Images"] },
];

const recordTypes = ["Daily Collection", "Saving Summary", "Loan Summary", "Weekly Loan Summary", "Bank Transaction", "Cash Book"];
const branchRecords = ["Dugbe2", "Bodija2", "SAKI_2", "Ilesha_2", "dugbe", "lalupon", "BODIJA_3", "OYO_2", "IFE BRANCH", "ologuneru", "OYO_1", "Challenge", "Osogbo", "Igboora", "Eruwa", "Igbeti_1", "apete_1", "oje_1", "ILORIN BRANCH", "sango_2", "apata", "ashipa branch", "Apata_2", "Ikire", "ayeye", "AYETORO", "ELEBU", "ajagun", "New Garage", "Testing Branch", "Ogbomosho_2", "GBAGI INDIVIDUAL1", "Gbagi", "moniya_2", "Amuloko", "Lalate branch", "Ayeye_2", "moniya_3", "TEDE BRANCH", "Bodija", "iwotown", "Ilesha 1", "AWOTAN", "Abeokuta 1", "BODIJA INDIVIDUAL", "ilorin_2", "Osogbo 1", "Oloosaoko", "moniya_1", "ADEGBAYI", "OJE_3", "MOWE", "SANGO_3", "Ogbomosho 1", "ISEYIN 1", "Saki", "Ede 1", "AKOBO", "PAARA IDI OSAN", "Akobo_2", "Challenge", "olorunsogo", "Abeokuta", "sango_1", "Sango Individual 1", "olodo", "iwo_road", "OLOMI", "OKEHO", "Sango Individual 2", "Dugbe3", "Iwo_road2", "Shagamu", "Igboho", "Adegbayi 1", "Lanlate", "gbagi2", "AYEYE 2", "Apata 2", "HEADOFFICE", "DUGBE_2", "Iwo Town", "none", "Am_1b"];

function Item({ label }: { label: string }) {
  return <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-800">{label}</button>;
}

export default function DailyWalletPage() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string[]>([sections[0].title]);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const filteredSections = useMemo(() => sections.map(s => ({ ...s, items: s.items.filter(i => i.toLowerCase().includes(query.toLowerCase())) })).filter(s => s.items.length), [query]);

  const toggle = (title: string) => setOpen(v => v.includes(title) ? v.filter(x => x !== title) : [...v, title]);

  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <aside className={`fixed inset-y-0 left-0 z-50 overflow-y-auto bg-[#064d25] text-white shadow-xl transition-all duration-300 ${sidebarOpen ? "w-72" : "w-16"}`}>
      <div className={`sticky top-0 flex h-16 items-center border-b border-white/10 bg-[#064d25] ${sidebarOpen ? "px-3" : "justify-center"}`}>
        <div className={sidebarOpen ? "block" : "hidden"}><PWFBCompanyBrand small /></div>
        <button onClick={() => setSidebarOpen(v => !v)} className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-xl" aria-label="Toggle sidebar">{sidebarOpen ? "‹" : "›"}</button>
      </div>
      {sidebarOpen && <div className="p-3"><Link href="/customer-wallet" className="block rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15">← Main Customer Wallet</Link></div>}
      <div className={sidebarOpen ? "px-3 pb-5" : "hidden"}>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-200">Daily Wallet</p>
        {sections.map(s => <div key={s.title} className="mb-2 overflow-hidden rounded-xl border border-white/10 bg-white/[.04]"><button onClick={() => toggle(s.title)} className="flex w-full items-center justify-between px-3 py-3 text-left text-xs font-bold"><span>{s.title}</span><span>{open.includes(s.title) ? "−" : "+"}</span></button>{open.includes(s.title) && <div className="space-y-0.5 border-t border-white/10 p-1">{s.items.map(i => <button key={i} className="w-full rounded-md px-2 py-1.5 text-left text-[11px] text-emerald-50/85 hover:bg-white/10 hover:text-white">{i}</button>)}</div>}</div>)}
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[.04]"><button onClick={() => setRecordsOpen(v => !v)} className="flex w-full items-center justify-between px-3 py-3 text-left text-xs font-bold"><span>Branch Records</span><span>{recordsOpen ? "−" : "+"}</span></button>{recordsOpen && <div className="border-t border-white/10 p-2">{branchRecords.map(branch => <details key={branch} className="group border-b border-white/5 last:border-0"><summary className="cursor-pointer list-none px-1 py-2 text-[11px] font-semibold text-emerald-50/90">{branch} <span className="float-right opacity-50">+</span></summary><div className="pb-2 pl-2">{recordTypes.map(type => <button key={type} className="block w-full rounded px-2 py-1 text-left text-[10px] text-emerald-100/70 hover:bg-white/10 hover:text-white">{branch} {type}</button>)}</div></details>)}</div>}</div>}
      </div>
    </aside>

    <div className={`transition-all duration-300 ${sidebarOpen ? "lg:ml-72" : "lg:ml-16"}`}>
      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur">
        <button onClick={() => setSidebarOpen(v => !v)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-lg">☰</button>
        <div className="ml-3"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">PWFB Wallet</p><h1 className="text-base font-bold">Daily Operations Wallet</h1></div>
        <div className="ml-auto flex items-center gap-2"><span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:inline">Operations</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">Inbox 0</span></div>
      </header>

      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <section className="rounded-2xl bg-[#064d25] p-5 text-white shadow-sm sm:p-7"><p className="text-xs font-semibold uppercase tracking-[.2em] text-emerald-200">Separate PWFB wallet</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">Daily Collection & Branch Operations</h2><p className="mt-2 max-w-2xl text-sm text-emerald-50/80">A dedicated operations wallet for daily collections, savings, loans, branch records, staff management and financial controls.</p><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-white/10 p-3"><p className="text-[10px] text-emerald-100/70">Opening Balance</p><p className="mt-1 text-lg font-bold">₦0.00</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-[10px] text-emerald-100/70">Daily Collection</p><p className="mt-1 text-lg font-bold">₦0.00</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-[10px] text-emerald-100/70">Savings</p><p className="mt-1 text-lg font-bold">₦0.00</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-[10px] text-emerald-100/70">Loans</p><p className="mt-1 text-lg font-bold">₦0.00</p></div></div></section>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Daily Wallet functions..." className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-emerald-500"/><Link href="/customer-wallet" className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">Customer Wallet</Link></div>

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredSections.map(s => <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="mb-3 text-sm font-bold text-slate-900">{s.title}</h3><div className="grid gap-1">{s.items.map(i => <Item key={i} label={i} />)}</div></div>)}</section>

        {!query && <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-bold">Branch Record Directory</h3><p className="text-xs text-slate-500">Select a branch to view its daily operational records.</p></div><button onClick={() => setRecordsOpen(v => !v)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{recordsOpen ? "Hide" : "Show"} branches</button></div>{recordsOpen && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{branchRecords.map(b => <details key={b} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold">{b}</summary><div className="mt-2 space-y-1">{recordTypes.map(t => <button key={t} className="block w-full rounded-md px-2 py-1 text-left text-xs text-slate-600 hover:bg-white hover:text-emerald-700">{t}</button>)}</div></details>)}</div>}</section>}
      </div>
    </div>
  </main>;
}
