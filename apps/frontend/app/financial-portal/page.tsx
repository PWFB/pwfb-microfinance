"use client";

import { useMemo, useState } from "react";

type PayrollRow = {
  region: string; branch: string; name: string; gra: string;
  gross: number; bonus: number; coopS: number; coopL: number;
  dev: number; tax: number; offline: number; others: number; advance: number;
};

type TransportRow = {
  code: string; bank: string; acc: string; name: string;
  amount: number; narration: string; ref: string;
};

type CoopRow = {
  name: string; aprSav: number; mayColl: number; mayWT: number;
  aprLoan: number; mayLoanColl: number; mayLoanPaid: number;
};

const payrollData: PayrollRow[] = [
  { region: "DM 1", branch: "ILORIN 2", name: "OGUNJEBE MICHEAL", gra: "83", gross: 216000, bonus: 0, coopS: 0, coopL: 0, dev: 5400, tax: 6480, offline: 500, others: 0, advance: 0 },
  { region: "DM 1", branch: "ILORIN 2", name: "OKANLAWON FAIDAT.O", gra: "325", gross: 136400, bonus: 0, coopS: 0, coopL: 0, dev: 3410, tax: 4100, offline: 0, others: 0, advance: 0 },
  { region: "DM 1", branch: "ILORIN 2", name: "CLEMENT EFFIONG ASUKWO", gra: "569", gross: 148800, bonus: 40900, coopS: 0, coopL: 0, dev: 3720, tax: 4465, offline: 0, others: 0, advance: 0 },
  { region: "DM 1", branch: "SANGO 2", name: "ADEBIYI OLUWAKEMI", gra: "56", gross: 216000, bonus: 0, coopS: 10000, coopL: 0, dev: 5400, tax: 6480, offline: 500, others: 0, advance: 0 },
  { region: "DM 1", branch: "SANGO 2", name: "BAKRIN RAHANAT R.", gra: "126", gross: 163600, bonus: 0, coopS: 10000, coopL: 0, dev: 4090, tax: 4910, offline: 0, others: 0, advance: 0 },
  { region: "DM 1", branch: "SANGO 2", name: "LABA ADEWUMI OPEYEMI", gra: "152", gross: 163600, bonus: 0, coopS: 10000, coopL: 0, dev: 4090, tax: 4910, offline: 0, others: 0, advance: 0 },
  { region: "DM 1", branch: "SANGO 2", name: "ADEYEMI SHITTU", gra: "603", gross: 148800, bonus: 0, coopS: 0, coopL: 0, dev: 930, tax: 1115, offline: 0, others: 0, advance: 80000 },
  { region: "DM 2", branch: "AWOTAN", name: "JOSEPH RAPHAEL", gra: "64", gross: 216000, bonus: 54000, coopS: 0, coopL: 0, dev: 5400, tax: 6480, offline: 500, others: 112895, advance: 0 },
  { region: "DM 2", branch: "AWOTAN", name: "ABIOLA VICTORIA", gra: "180", gross: 163600, bonus: 40900, coopS: 0, coopL: 0, dev: 4090, tax: 4910, offline: 0, others: 0, advance: 0 },
  { region: "DM 2", branch: "AWOTAN", name: "OLAOLUWA NAFISAT ADEJOKE", gra: "151", gross: 163600, bonus: 40900, coopS: 0, coopL: 0, dev: 4090, tax: 4910, offline: 0, others: 0, advance: 0 },
  { region: "DM 2", branch: "MONIYA 3", name: "KAYODE OLUWADAMILARE", gra: "126", gross: 216000, bonus: 54000, coopS: 0, coopL: 0, dev: 5400, tax: 6480, offline: 500, others: 142355, advance: 0 },
  { region: "DM 2", branch: "AKOBO 2", name: "OMOTOSHO SHOLA MERCY", gra: "79", gross: 216000, bonus: 54000, coopS: 0, coopL: 0, dev: 5400, tax: 6480, offline: 500, others: 113045, advance: 0 },
];

const transportData: TransportRow[] = [
  { code: "000017", bank: "Wema/ALAT", acc: "0280064037", name: "JOSEPH ANIEBIET RAPHEAL", amount: 257620, narration: "BM AWOTAN", ref: "001" },
  { code: "000017", bank: "Wema/ALAT", acc: "0261295863", name: "VICTORIA BUKOLA ABIOLA", amount: 195500, narration: "AWOTAN", ref: "002" },
  { code: "000014", bank: "Access Bank", acc: "1455923913", name: "NAFISAT ADEJOKE OLAOLUWA", amount: 195500, narration: "AWOTAN", ref: "003" },
  { code: "000017", bank: "Wema/ALAT", acc: "0280145332", name: "OLUWASEUN RACHEAL ADEBAYO", amount: 165500, narration: "AWOTAN", ref: "004" },
  { code: "000017", bank: "Wema/ALAT", acc: "0279962919", name: "PAULINA OLUWADAMILARE KAYODE", amount: 229520, narration: "BM MONIYA 3", ref: "005" },
  { code: "000010", bank: "EcoBank", acc: "2280088175", name: "AYORINDE DORCAS OYEKANMI", amount: 114600, narration: "MONIYA 3", ref: "006" },
];

const coopData: CoopRow[] = [
  { name: "BUSARI IDOWU", aprSav: 65575, mayColl: 10000, mayWT: 0, aprLoan: 343800, mayLoanColl: 166700, mayLoanPaid: 0 },
  { name: "BUSARI ALABA", aprSav: 18245, mayColl: 10000, mayWT: 0, aprLoan: 999600, mayLoanColl: 166700, mayLoanPaid: 0 },
  { name: "BOLARINWA MOTUNRAYO", aprSav: 100110, mayColl: 10000, mayWT: 0, aprLoan: 499500, mayLoanColl: 166700, mayLoanPaid: 0 },
  { name: "BABATUNDE FLORENCE", aprSav: 195000, mayColl: 5000, mayWT: 0, aprLoan: 250000, mayLoanColl: 125000, mayLoanPaid: 0 },
];

const money = (n: number) => `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const csvEscape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function SparkleLogo() {
  return (
    <svg viewBox="0 0 100 100" aria-label="PWFB logo" className="portal-logo">
      <defs>
        <linearGradient id="pwfb-sparkle-gradient" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0788f5" />
          <stop offset=".52" stopColor="#2b8df5" />
          <stop offset="1" stopColor="#a66ff4" />
        </linearGradient>
      </defs>
      <path d="M50 4C53 31 58 42 96 50C58 54 53 64 50 96C47 64 42 54 4 50C42 46 47 36 50 4Z" fill="url(#pwfb-sparkle-gradient)" />
    </svg>
  );
}

export default function FinancialPortalPage() {
  const [tab, setTab] = useState<"payroll" | "transport" | "coop">("payroll");
  const [region, setRegion] = useState("ALL");
  const [query, setQuery] = useState("");

  const filteredPayroll = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payrollData.filter((row) => {
      const regionMatch = region === "ALL" || row.region === region;
      const textMatch = !q || Object.values(row).join(" ").toLowerCase().includes(q);
      return regionMatch && textMatch;
    });
  }, [region, query]);

  const payrollTotals = useMemo(() => filteredPayroll.reduce((t, row) => {
    const totalDed = row.coopS + row.coopL + row.dev + row.tax + row.offline + row.others + row.advance;
    const grossPay = row.gross + row.bonus;
    return {
      gross: t.gross + row.gross, bonus: t.bonus + row.bonus, coopS: t.coopS + row.coopS,
      coopL: t.coopL + row.coopL, dev: t.dev + row.dev, tax: t.tax + row.tax,
      offline: t.offline + row.offline, others: t.others + row.others, advance: t.advance + row.advance,
      totalDed: t.totalDed + totalDed, netPay: t.netPay + grossPay - totalDed,
    };
  }, { gross: 0, bonus: 0, coopS: 0, coopL: 0, dev: 0, tax: 0, offline: 0, others: 0, advance: 0, totalDed: 0, netPay: 0 }), [filteredPayroll]);

  function exportCurrentTabCSV() {
    let headers: string[] = [];
    let rows: unknown[][] = [];

    if (tab === "payroll") {
      headers = ["Region","Branch","Name","GRA No","Gross","Bonus","Coop.S","Coop.L","Dev 2.5%","Tax 3%","Offline","Others","Advance","Total Deduction","Net Pay"];
      rows = filteredPayroll.map((r) => {
        const deduction = r.coopS + r.coopL + r.dev + r.tax + r.offline + r.others + r.advance;
        return [r.region,r.branch,r.name,r.gra,r.gross,r.bonus,r.coopS,r.coopL,r.dev,r.tax,r.offline,r.others,r.advance,deduction,r.gross+r.bonus-deduction];
      });
    } else if (tab === "transport") {
      headers = ["Bank Code","Destination Bank","Account No","Account Name","Amount","Narration","Ref"];
      rows = transportData.map((r) => [r.code,r.bank,r.acc,r.name,r.amount,r.narration,r.ref]);
    } else {
      headers = ["Member Name","April Sav. Bal","May S. Coll","May Sav. WT","Sav. Bal","April Loan Bal","May Loan Collec","May Loan Paid","Loan Bal"];
      rows = coopData.map((r) => [r.name,r.aprSav,r.mayColl,r.mayWT,r.aprSav+r.mayColl-r.mayWT,r.aprLoan,r.mayLoanColl,r.mayLoanPaid,r.aprLoan+r.mayLoanColl-r.mayLoanPaid]);
    }

    const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pwfb-financial-portal-${tab}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="financial-portal">
      <header className="portal-header">
        <div className="portal-brand">
          <SparkleLogo />
          <div>
            <h1>PWFB-microfinance</h1>
            <p>Financial Portal</p>
          </div>
        </div>
        <button type="button" onClick={exportCurrentTabCSV} className="portal-export">⇩ Export CSV</button>
      </header>

      <nav className="portal-tabs" aria-label="Financial portal sections">
        {([
          ["payroll", "▣", "Monthly Payroll"],
          ["transport", "▰", "Transport & Salary Schedule"],
          ["coop", "▤", "Co-operative Ledger"],
        ] as const).map(([key, icon, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={tab === key ? "portal-tab active" : "portal-tab"}>
            <span>{icon}</span>{label}
          </button>
        ))}
      </nav>

      <section className="portal-toolbar">
        <label className="portal-search">
          <span>⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search staff, account, or branch..." />
        </label>
        {tab === "payroll" && (
          <div className="portal-filters">
            {["ALL", "DM 1", "DM 2"].map((r) => (
              <button key={r} type="button" onClick={() => setRegion(r)} className={region === r ? "region-btn selected" : "region-btn"}>
                {r === "ALL" ? "All Regions" : `${r} (Region ${r === "DM 1" ? "1" : "2"})`}
              </button>
            ))}
          </div>
        )}
      </section>

      {tab === "payroll" && (
        <section className="portal-card">
          <div className="portal-card-header">
            <h2>Monthly Payroll Management (DM 1 &amp; DM 2)</h2>
            <span>August 2026</span>
          </div>
          <div className="portal-table-wrap">
            <table className="portal-table payroll-table">
              <thead><tr>
                {["Region","Branch","Name","GRA No","Gross (1)","Bonus (2)","Coop.S (3)","Coop.L (4)","Dev 2.5% (5)","Tax 3% (6)","Offline (7)","Others (8)","Adv. (9)","Tot Ded (10)","Net Pay (11)"].map((h) => <th key={h}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredPayroll.map((row) => {
                  const deduction = row.coopS + row.coopL + row.dev + row.tax + row.offline + row.others + row.advance;
                  return <tr key={row.gra + row.name}>
                    <td>{row.region}</td><td><b>{row.branch}</b></td><td><b className="dark">{row.name}</b></td><td>{row.gra}</td>
                    <td>{money(row.gross)}</td><td>{money(row.bonus)}</td><td>{money(row.coopS)}</td><td>{money(row.coopL)}</td>
                    <td>{money(row.dev)}</td><td>{money(row.tax)}</td><td>{money(row.offline)}</td><td>{money(row.others)}</td><td>{money(row.advance)}</td>
                    <td className="deduction">{money(deduction)}</td><td className="net">{money(row.gross + row.bonus - deduction)}</td>
                  </tr>;
                })}
              </tbody>
              <tfoot><tr>
                <td colSpan={4}>Total Summary ({region})</td>
                <td>{money(payrollTotals.gross)}</td><td>{money(payrollTotals.bonus)}</td><td>{money(payrollTotals.coopS)}</td><td>{money(payrollTotals.coopL)}</td>
                <td>{money(payrollTotals.dev)}</td><td>{money(payrollTotals.tax)}</td><td>{money(payrollTotals.offline)}</td><td>{money(payrollTotals.others)}</td><td>{money(payrollTotals.advance)}</td>
                <td>{money(payrollTotals.totalDed)}</td><td className="footer-net">{money(payrollTotals.netPay)}</td>
              </tr></tfoot>
            </table>
          </div>
          {filteredPayroll.length === 0 && <div className="portal-empty">No payroll records match the current filters.</div>}
        </section>
      )}

      {tab === "transport" && (
        <section className="portal-card">
          <div className="portal-card-header">
            <h2>Bank Disbursement Schedule</h2>
            <span className="orange-badge">Batch Total: ₦11,948,980.00</span>
          </div>
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr>{["Bank Code","Destination Bank","Account No","Account Name","Amount (₦)","Narration","Ref"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{transportData.map((r) => <tr key={r.ref}>
                <td className="mono">{r.code}</td><td><b>{r.bank}</b></td><td className="mono">{r.acc}</td><td><b className="dark">{r.name}</b></td>
                <td className="amount-green">{money(r.amount)}</td><td>{r.narration}</td><td className="mono center">{r.ref}</td>
              </tr>)}</tbody>
              <tfoot><tr><td colSpan={4}>Total Scheduled Disbursement</td><td className="footer-net">₦11,948,980.00</td><td colSpan={2}></td></tr></tfoot>
            </table>
          </div>
        </section>
      )}

      {tab === "coop" && (
        <section className="portal-card">
          <div className="portal-card-header">
            <h2>Co-operative Savings &amp; Loan Ledger</h2>
            <span className="blue-badge">Sheet 84</span>
          </div>
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr>{["Member Name","April Sav. Bal (1)","May S. Coll (2)","May Sav. WT (3)","Sav. Bal (4=1+2-3)","April Loan Bal (5)","May Loan Collec (6)","May Loan Paid (7)","Loan Bal (8=5+6-7)"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{coopData.map((r) => {
                const sav = r.aprSav + r.mayColl - r.mayWT;
                const loan = r.aprLoan + r.mayLoanColl - r.mayLoanPaid;
                return <tr key={r.name}><td><b className="dark">{r.name}</b></td><td>{money(r.aprSav)}</td><td>{money(r.mayColl)}</td><td>{money(r.mayWT)}</td><td className="net">{money(sav)}</td><td>{money(r.aprLoan)}</td><td>{money(r.mayLoanColl)}</td><td>{money(r.mayLoanPaid)}</td><td className="loan">{money(loan)}</td></tr>;
              })}</tbody>
              <tfoot><tr>
                <td>Total Portfolio</td>
                <td>{money(coopData.reduce((s,r)=>s+r.aprSav,0))}</td><td>{money(coopData.reduce((s,r)=>s+r.mayColl,0))}</td><td>{money(coopData.reduce((s,r)=>s+r.mayWT,0))}</td>
                <td>{money(coopData.reduce((s,r)=>s+r.aprSav+r.mayColl-r.mayWT,0))}</td><td>{money(coopData.reduce((s,r)=>s+r.aprLoan,0))}</td><td>{money(coopData.reduce((s,r)=>s+r.mayLoanColl,0))}</td><td>{money(coopData.reduce((s,r)=>s+r.mayLoanPaid,0))}</td><td>{money(coopData.reduce((s,r)=>s+r.aprLoan+r.mayLoanColl-r.mayLoanPaid,0))}</td>
              </tr></tfoot>
            </table>
          </div>
        </section>
      )}

      <footer className="portal-footer">PWFB-microfinance Financial Portal © 2026. All rights reserved.</footer>

      <style jsx>{`
        .financial-portal{min-height:calc(100vh - 10px);color:#1f2937;background:#f3f4f6;margin:-28px;padding:0 0 20px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .portal-header{position:sticky;top:70px;z-index:20;display:flex;justify-content:space-between;align-items:center;padding:14px max(16px,calc((100% - 1440px)/2));background:#fff;border-bottom:1px solid #e5e7eb;box-shadow:0 2px 10px rgba(0,0,0,.04)}
        .portal-brand{display:flex;align-items:center;gap:12px}.portal-logo{width:44px;height:44px;filter:drop-shadow(0 4px 7px rgba(70,95,255,.16))}.portal-brand h1{margin:0;font-size:19px;line-height:1.1;font-weight:850;color:#111827}.portal-brand p{margin:3px 0 0;color:#f58220;font-size:10px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}
        .portal-export{border:0;border-radius:9px;padding:9px 13px;background:#008751;color:#fff;font-size:12px;font-weight:800;box-shadow:0 5px 12px rgba(0,135,81,.18)}.portal-export:hover{background:#005c37}
        .portal-tabs{display:flex;gap:8px;overflow:auto;padding:0 max(16px,calc((100% - 1440px)/2));background:#f9fafb;border-bottom:1px solid #e5e7eb}
        .portal-tab{flex:0 0 auto;border:0;border-bottom:3px solid transparent;padding:12px 12px;background:transparent;color:#6b7280;font-size:12px;font-weight:750;white-space:nowrap}.portal-tab span{margin-right:7px}.portal-tab.active{border-bottom-color:#f58220;color:#f58220}
        .portal-toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;max-width:1440px;margin:18px auto;padding:13px;background:#fff;border:1px solid #e5e7eb;border-radius:13px;box-shadow:0 2px 9px rgba(0,0,0,.035)}
        .portal-search{position:relative;display:flex;align-items:center;width:min(390px,100%);color:#9ca3af}.portal-search span{position:absolute;left:11px;font-size:21px}.portal-search input{width:100%;height:39px;padding:8px 12px 8px 35px;border:1px solid #d1d5db;border-radius:8px;outline:none;font-size:12px}.portal-search input:focus{border-color:#008751;box-shadow:0 0 0 3px rgba(0,135,81,.1)}
        .portal-filters{display:flex;gap:7px;overflow:auto}.region-btn{border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;background:#fff;color:#4b5563;font-size:10px;font-weight:800;white-space:nowrap}.region-btn.selected{border-color:#1f2937;background:#1f2937;color:#fff}
        .portal-card{max-width:1440px;margin:0 auto 20px;border:1px solid #e5e7eb;border-radius:13px;background:#fff;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.035)}.portal-card-header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #e5e7eb;background:#f9fafb}.portal-card-header h2{margin:0;font-size:14px;font-weight:850;color:#374151}.portal-card-header span{border-radius:999px;padding:5px 9px;background:#dcfce7;color:#166534;font-size:9px;font-weight:900;white-space:nowrap}.portal-card-header .orange-badge{background:#ffedd5;color:#ea580c}.portal-card-header .blue-badge{background:#dbeafe;color:#1e40af}
        .portal-table-wrap{width:100%;overflow:auto}.portal-table{width:100%;border-collapse:collapse;min-width:1120px;font-size:10px}.portal-table th{padding:10px 9px;border-bottom:1px solid #d1d5db;background:#f3f4f6;color:#4b5563;text-align:left;font-size:8px;font-weight:900;text-transform:uppercase;white-space:nowrap}.portal-table td{padding:10px 9px;border-bottom:1px solid #f0f1f2;white-space:nowrap;color:#4b5563}.portal-table tbody tr:hover{background:#f9fafb}.portal-table td.dark{color:#111827}.portal-table .deduction{color:#dc2626;font-weight:750}.portal-table .net{color:#166534;font-weight:900;background:#f0fdf4}.portal-table .loan{color:#dc2626;font-weight:900;background:#fef2f2}.portal-table .amount-green{color:#166534;font-weight:800}.portal-table .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.portal-table .center{text-align:center}
        .portal-table tfoot{background:#1f2937;color:#fff;font-weight:900}.portal-table tfoot td{border:0;color:#fff}.portal-table tfoot .footer-net{background:#111827;color:#facc15;font-size:11px}.portal-empty{padding:30px;text-align:center;color:#6b7280;font-size:12px}.portal-footer{max-width:1440px;margin:8px auto 0;padding:16px;text-align:center;color:#6b7280;font-size:10px}
        @media(max-width:800px){.financial-portal{margin:-14px}.portal-header{top:64px;padding:11px 12px}.portal-brand h1{font-size:16px}.portal-logo{width:38px;height:38px}.portal-export{font-size:10px;padding:8px 10px}.portal-toolbar{margin:12px;border-radius:11px;align-items:stretch;flex-direction:column}.portal-search{width:100%}.portal-filters{width:100%}.portal-card{margin:0 12px 14px;border-radius:11px}.portal-card-header{align-items:flex-start;flex-direction:column}.portal-footer{padding:14px 12px}.portal-table{min-width:1120px}}
      `}</style>
    </main>
  );
}
