"use client";

import Link from "next/link";

export default function ReportsPage() {
  const reports = [
    {
      title: "Portfolio Report",
      description: "Overview of savings, loans and portfolio value.",
      href: "/dashboard",
      icon: "📊",
    },
    {
      title: "Customer Report",
      description: "Customer registration and account activity.",
      href: "/customers",
      icon: "👥",
    },
    {
      title: "Loan Report",
      description: "Loan balances, disbursements and status.",
      href: "/loans",
      icon: "🏦",
    },
    {
      title: "Repayment Report",
      description: "Repayment activity and collections.",
      href: "/repayments",
      icon: "↩️",
    },
    {
      title: "Savings Report",
      description: "Savings accounts and deposit activity.",
      href: "/savings",
      icon: "💰",
    },
    {
      title: "Transaction Report",
      description: "Customer transaction activity and values.",
      href: "/transactions",
      icon: "↔️",
    },
  ];

  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">REPORTS & ANALYTICS</p>
          <h1 className="pwfb-page-title">Reports</h1>
          <p className="pwfb-page-description">
            Monitor PWFB operations and review financial activity.
          </p>
        </div>
      </div>

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card">
          <span>Available Reports</span>
          <strong>{reports.length}</strong>
          <small>Operational reports</small>
        </div>

        <div className="pwfb-stat-card pwfb-stat-orange">
          <span>Access Level</span>
          <strong>Admin</strong>
          <small>Reports & analytics</small>
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Report Centre</h2>
            <p>Select an operational area to review.</p>
          </div>
        </div>

        <div className="pwfb-department-grid">
          {reports.map((report) => (
            <Link
              key={report.title}
              href={report.href}
              className="pwfb-department-card"
            >
              <div className="pwfb-department-icon">{report.icon}</div>

              <div>
                <h3>{report.title}</h3>
                <p>{report.description}</p>
              </div>

              <span className="pwfb-department-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
