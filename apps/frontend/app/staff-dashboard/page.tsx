"use client";

import Link from "next/link";

const departments = [
  {
    name: "Administration",
    description: "Manage administration and organizational operations.",
    icon: "🏢",
  },
  {
    name: "Monitoring",
    description: "Monitor operations, performance and compliance.",
    icon: "📊",
  },
  {
    name: "Customer Service",
    description: "Handle customer support and service requests.",
    icon: "👥",
  },
  {
    name: "Savings",
    description: "Manage customer savings and deposits.",
    icon: "💰",
  },
  {
    name: "Loans",
    description: "Manage loan applications and loan operations.",
    icon: "🏦",
  },
  {
    name: "Teller Operations",
    description: "Manage cash and daily teller transactions.",
    icon: "💵",
  },
  {
    name: "Finance & Accounts",
    description: "Manage financial records and accounting.",
    icon: "📒",
  },
  {
    name: "Risk & Compliance",
    description: "Monitor risk, controls and regulatory compliance.",
    icon: "🛡️",
  },
  {
    name: "Reports & Analytics",
    description: "Review operational reports and performance data.",
    icon: "📈",
  },
  {
    name: "Human Resources",
    description: "Manage staff records and human resources.",
    icon: "🧑‍💼",
  },
];

export default function StaffDashboardPage() {
  return (
    <main>
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">STAFF OPERATIONS</p>
          <h1 className="pwfb-page-title">Staff Dashboard</h1>
          <p className="pwfb-page-description">
            Manage departments, staff operations and internal services.
          </p>
        </div>

        <Link href="/dashboard" className="pwfb-secondary-button">
          ← Main Dashboard
        </Link>
      </div>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Departments</h2>
            <p>Access the main PWFB operational departments.</p>
          </div>

          <span className="pwfb-record-count">
            {departments.length} departments
          </span>
        </div>

        <div className="pwfb-department-grid">
          {departments.map((department) => (
            <div className="pwfb-department-card" key={department.name}>
              <div className="pwfb-department-icon">
                {department.icon}
              </div>

              <div>
                <h3>{department.name}</h3>
                <p>{department.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header">
          <div>
            <h2>Quick Access</h2>
            <p>Frequently used management areas.</p>
          </div>
        </div>

        <div className="pwfb-quick-grid">
          <Link href="/customers" className="pwfb-quick-card">
            <strong>Customers</strong>
            <span>Customer records and KYC</span>
          </Link>

          <Link href="/loans" className="pwfb-quick-card">
            <strong>Loans</strong>
            <span>Loan portfolio management</span>
          </Link>

          <Link href="/savings" className="pwfb-quick-card">
            <strong>Savings</strong>
            <span>Savings and deposits</span>
          </Link>

          <Link href="/transactions" className="pwfb-quick-card">
            <strong>Transactions</strong>
            <span>Financial transactions</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
