"use client";

import Link from "next/link";
import PWFBCompanyBrand from "../../components/PWFBCompanyBrand";

const departments = [
  {
    name: "Administration",
    description: "Manage administration and organizational operations.",
    icon: "🏢",
    href: "/api-workbench",
  },
  {
    name: "Monitoring",
    description: "Monitor operations, performance and compliance.",
    icon: "📊",
    href: "/reports",
  },
  {
    name: "Customer Service",
    description: "Handle customer support and service requests.",
    icon: "👥",
    href: "/customers",
  },
  {
    name: "Savings",
    description: "Manage customer savings and deposits.",
    icon: "💰",
    href: "/savings",
  },
  {
    name: "Loans",
    description: "Manage loan applications and loan operations.",
    icon: "🏦",
    href: "/loans",
  },
  {
    name: "Teller Operations",
    description: "Manage cash and daily teller transactions.",
    icon: "💵",
    href: "/transactions",
  },
  {
    name: "Finance & Accounts",
    description: "Manage financial records and accounting.",
    icon: "📒",
    href: "/cashbook",
  },
  {
    name: "Risk & Compliance",
    description: "Monitor risk, controls and regulatory compliance.",
    icon: "🛡️",
    href: "/reports",
  },
  {
    name: "Reports & Analytics",
    description: "Review operational reports and performance data.",
    icon: "📈",
    href: "/reports",
  },
  {
    name: "Human Resources",
    description: "Manage staff records and human resources.",
    icon: "🧑‍💼",
    href: "/staff-dashboard",
  },
];

export default function StaffDashboardPage() {
  return (
    <main>
      <div className="pwfb-dashboard-company-brand staff"><PWFBCompanyBrand small /></div>
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
            <Link href={department.href} className="pwfb-department-card" key={department.name}>
              <div className="pwfb-department-icon">
                {department.icon}
              </div>

              <div>
                <h3>{department.name}</h3>
                <p>{department.description}</p>
              </div>
            </Link>
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
