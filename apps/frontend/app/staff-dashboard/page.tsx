"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface StaffProfile {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
}

interface Loan {
  id: string;
  amount?: number;
  status?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const modules = [
  { title: "Customers", description: "Customer records, KYC and account support.", icon: "👥", href: "/customers", tone: "green" },
  { title: "Loans", description: "Applications, approvals, balances and repayments.", icon: "💼", href: "/loans", tone: "orange" },
  { title: "Savings", description: "Manage savings accounts and customer deposits.", icon: "💰", href: "/savings", tone: "green" },
  { title: "Transactions", description: "Review and process daily financial activity.", icon: "↔", href: "/transactions", tone: "orange" },
  { title: "Collections", description: "Track collection activity and daily performance.", icon: "✓", href: "/collections", tone: "green" },
  { title: "Reports", description: "Operational reports and performance information.", icon: "▥", href: "/reports", tone: "orange" },
];

export default function StaffDashboardPage() {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") || sessionStorage.getItem("token") : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    Promise.all([
      fetch(`${API_URL}/auth/profile`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${API_URL}/loans`, { headers }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([user, loanData]) => {
      setProfile(user);
      setLoans(Array.isArray(loanData) ? loanData : []);
      setLoading(false);
    });
  }, []);

  const activeLoans = useMemo(
    () => loans.filter((loan) => (loan.status || "").toLowerCase() === "active").length,
    [loans],
  );

  const totalPortfolio = useMemo(
    () => loans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0),
    [loans],
  );

  const displayName = profile?.firstName
    ? `${profile.firstName}${profile.lastName ? ` ${profile.lastName}` : ""}`
    : "Staff Member";

  const roleLabel = (profile?.role || "STAFF").replaceAll("_", " ");

  return (
    <main className="staff-dashboard-page">
      <section className="staff-hero">
        <div className="staff-hero-copy">
          <span className="staff-kicker">PWFB • STAFF PORTAL</span>
          <h1>Good day, {displayName.split(" ")[0]}.</h1>
          <p>Everything you need for your daily PWFB operations, in one clean workspace.</p>
          <div className="staff-hero-actions">
            <Link href="/customers" className="staff-primary-action">Find a customer</Link>
            <Link href="/loans/add" className="staff-light-action">Create loan</Link>
          </div>
        </div>
        <div className="staff-profile-card">
          <div className="staff-avatar">{displayName.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{displayName}</strong>
            <span>{roleLabel}</span>
            {profile?.email && <small>{profile.email}</small>}
          </div>
          <span className="staff-online"><i /> Online</span>
        </div>
      </section>

      <section className="staff-stat-grid" aria-label="Staff overview">
        <article className="staff-stat-card">
          <div className="staff-stat-icon green">▣</div>
          <div><span>Loan accounts</span><strong>{loading ? "—" : loans.length}</strong><small>Total visible portfolio</small></div>
        </article>
        <article className="staff-stat-card">
          <div className="staff-stat-icon orange">₦</div>
          <div><span>Loan portfolio</span><strong>{loading ? "—" : `₦${totalPortfolio.toLocaleString("en-NG")}`}</strong><small>Principal value</small></div>
        </article>
        <article className="staff-stat-card">
          <div className="staff-stat-icon green">✓</div>
          <div><span>Active loans</span><strong>{loading ? "—" : activeLoans}</strong><small>Currently active</small></div>
        </article>
        <article className="staff-stat-card">
          <div className="staff-stat-icon orange">●</div>
          <div><span>Work status</span><strong>Ready</strong><small>Staff workspace active</small></div>
        </article>
      </section>

      <section className="staff-section-heading">
        <div><span>WORKSPACE</span><h2>Daily operations</h2></div>
        <p>Select an area to continue your work.</p>
      </section>

      <section className="staff-module-grid">
        {modules.map((module) => (
          <Link href={module.href} className="staff-module-card" key={module.title}>
            <div className={`staff-module-icon ${module.tone}`}>{module.icon}</div>
            <div className="staff-module-content"><h3>{module.title}</h3><p>{module.description}</p></div>
            <span className="staff-arrow">→</span>
          </Link>
        ))}
      </section>

      <section className="staff-bottom-grid">
        <div className="staff-panel">
          <div className="staff-panel-head"><div><span>QUICK ACTIONS</span><h2>Start something</h2></div></div>
          <div className="staff-action-list">
            <Link href="/customers/add"><b>＋</b><div><strong>Add customer</strong><span>Register a new customer profile</span></div><em>→</em></Link>
            <Link href="/loans/add"><b>₦</b><div><strong>Add loan</strong><span>Create a new loan record</span></div><em>→</em></Link>
            <Link href="/transactions/add"><b>↔</b><div><strong>Record transaction</strong><span>Post a financial transaction</span></div><em>→</em></Link>
          </div>
        </div>

        <div className="staff-panel staff-notice-panel">
          <span className="staff-panel-label">STAFF NOTICE</span>
          <div className="staff-notice-icon">✓</div>
          <h2>Keep customer records accurate</h2>
          <p>Always verify customer details before creating financial records or processing account activity.</p>
          <Link href="/customers" className="staff-text-link">Open customer records →</Link>
        </div>
      </section>

      <style jsx>{`
        .staff-dashboard-page { max-width: 1440px; margin: 0 auto; padding: 8px 0 44px; }
        .staff-hero { position: relative; overflow: hidden; display: flex; justify-content: space-between; gap: 28px; padding: 34px; border-radius: 24px; background: linear-gradient(120deg, #075b2b 0%, #0f7b35 62%, #178744 100%); color: white; box-shadow: 0 18px 45px rgba(7,91,43,.16); }
        .staff-hero:after { content: ""; position: absolute; width: 310px; height: 310px; right: -100px; top: -140px; border: 42px solid rgba(242,140,24,.18); border-radius: 50%; }
        .staff-hero-copy, .staff-profile-card { position: relative; z-index: 1; }
        .staff-kicker, .staff-section-heading > div > span, .staff-panel-label { font-size: 11px; letter-spacing: .14em; font-weight: 900; color: #bce0c8; }
        .staff-hero h1 { margin: 9px 0 7px; font-size: clamp(30px, 4vw, 45px); line-height: 1.05; letter-spacing: -.045em; }
        .staff-hero p { max-width: 600px; margin: 0; color: #dceee2; font-size: 15px; line-height: 1.65; }
        .staff-hero-actions { display: flex; gap: 10px; margin-top: 23px; }
        .staff-primary-action, .staff-light-action { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; padding: 10px 17px; border-radius: 10px; font-size: 13px; font-weight: 800; }
        .staff-primary-action { background: #f28c18; color: #fff; box-shadow: 0 8px 18px rgba(242,140,24,.25); }
        .staff-light-action { background: rgba(255,255,255,.1); color: #fff; border: 1px solid rgba(255,255,255,.2); }
        .staff-profile-card { align-self: flex-start; display: flex; align-items: center; gap: 12px; min-width: 260px; padding: 14px; border: 1px solid rgba(255,255,255,.14); border-radius: 15px; background: rgba(255,255,255,.08); backdrop-filter: blur(8px); }
        .staff-avatar { width: 45px; height: 45px; display: grid; place-items: center; flex-shrink: 0; border-radius: 50%; background: #f28c18; color: #fff; font-weight: 900; }
        .staff-profile-card strong, .staff-profile-card span, .staff-profile-card small { display: block; }
        .staff-profile-card strong { font-size: 14px; }.staff-profile-card span { margin-top: 2px; color: #c7e5d0; font-size: 11px; text-transform: uppercase; }.staff-profile-card small { margin-top: 4px; color: #a9d2b6; font-size: 10px; }
        .staff-online { margin-left: auto; color: #d8f4df !important; white-space: nowrap; font-size: 10px !important; text-transform: none !important; }.staff-online i { display: inline-block !important; width: 6px; height: 6px; margin-right: 5px; border-radius: 50%; background: #7de39a; }
        .staff-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; margin: 18px 0 34px; }
        .staff-stat-card { display: flex; align-items: center; gap: 13px; padding: 19px; border: 1px solid var(--pwfb-border); border-radius: 16px; background: #fff; box-shadow: var(--pwfb-shadow); }.staff-stat-card span, .staff-stat-card small { display: block; color: #718078; font-size: 11px; }.staff-stat-card strong { display: block; margin: 4px 0 2px; font-size: 22px; letter-spacing: -.03em; }.staff-stat-icon { width: 42px; height: 42px; display: grid; place-items: center; flex-shrink: 0; border-radius: 12px; font-weight: 900; font-size: 17px; }.staff-stat-icon.green { background: var(--pwfb-green-light); color: var(--pwfb-green); }.staff-stat-icon.orange { background: var(--pwfb-orange-light); color: var(--pwfb-orange-dark); }
        .staff-section-heading { display: flex; align-items: end; justify-content: space-between; margin-bottom: 14px; }.staff-section-heading h2, .staff-panel h2 { margin: 4px 0 0; font-size: 21px; letter-spacing: -.025em; }.staff-section-heading p { margin: 0; color: #748078; font-size: 12px; }
        .staff-module-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }.staff-module-card { position: relative; display: flex; align-items: flex-start; gap: 14px; min-height: 142px; padding: 20px; border: 1px solid var(--pwfb-border); border-radius: 17px; background: #fff; box-shadow: 0 3px 14px rgba(15,123,53,.05); transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }.staff-module-card:hover { transform: translateY(-3px); border-color: #c8d9ce; box-shadow: 0 12px 28px rgba(15,123,53,.10); }.staff-module-icon { width: 44px; height: 44px; display: grid; place-items: center; flex-shrink: 0; border-radius: 12px; font-size: 18px; font-weight: 900; }.staff-module-icon.green { background: var(--pwfb-green-light); color: var(--pwfb-green); }.staff-module-icon.orange { background: var(--pwfb-orange-light); color: var(--pwfb-orange-dark); }.staff-module-content h3 { margin: 1px 0 6px; font-size: 15px; }.staff-module-content p { margin: 0; color: #718078; font-size: 12px; line-height: 1.55; }.staff-arrow { position: absolute; right: 18px; bottom: 16px; color: #9aa79f; font-size: 18px; }
        .staff-bottom-grid { display: grid; grid-template-columns: 1.35fr .85fr; gap: 14px; margin-top: 28px; }.staff-panel { padding: 22px; border: 1px solid var(--pwfb-border); border-radius: 18px; background: #fff; box-shadow: var(--pwfb-shadow); }.staff-panel-head { margin-bottom: 10px; }.staff-action-list a { display: flex; align-items: center; gap: 12px; padding: 13px 0; border-bottom: 1px solid #edf1ee; }.staff-action-list a:last-child { border-bottom: 0; }.staff-action-list b { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; background: var(--pwfb-green-light); color: var(--pwfb-green); }.staff-action-list div { flex: 1; }.staff-action-list strong, .staff-action-list span { display: block; }.staff-action-list strong { font-size: 13px; }.staff-action-list span { margin-top: 2px; color: #7b8780; font-size: 11px; }.staff-action-list em { color: #9aa79f; font-style: normal; }.staff-notice-panel { background: linear-gradient(145deg, #fff, #f8fcf9); }.staff-notice-icon { width: 45px; height: 45px; display: grid; place-items: center; margin: 17px 0 10px; border-radius: 50%; background: var(--pwfb-green-light); color: var(--pwfb-green); font-weight: 900; }.staff-notice-panel h2 { font-size: 18px; }.staff-notice-panel p { margin: 9px 0 15px; color: #68756d; font-size: 12px; line-height: 1.6; }.staff-text-link { color: var(--pwfb-green-dark); font-size: 12px; font-weight: 800; }
        @media (max-width: 1000px) { .staff-stat-grid { grid-template-columns: repeat(2,1fr); }.staff-module-grid { grid-template-columns: repeat(2,1fr); }.staff-hero { flex-direction: column; }.staff-profile-card { width: 100%; } }
        @media (max-width: 650px) { .staff-dashboard-page { padding-top: 0; }.staff-hero { padding: 24px 20px; border-radius: 18px; }.staff-stat-grid, .staff-module-grid, .staff-bottom-grid { grid-template-columns: 1fr; }.staff-section-heading { align-items: flex-start; flex-direction: column; gap: 5px; }.staff-profile-card { min-width: 0; }.staff-online { display: none !important; } }
      `}</style>
    </main>
  );
}
