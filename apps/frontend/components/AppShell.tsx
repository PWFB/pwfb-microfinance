"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["Dashboard", "/dashboard", "⌂"],
  ["Customers", "/customers", "👥"],
  ["Savings", "/savings", "💰"],
  ["Loans", "/loans", "🏦"],
  ["Repayments", "/repayments", "↩"],
  ["Transactions", "/transactions", "↔"],
  ["Staff", "/staff-dashboard", "👤"],
  ["Customer Portal", "/customer-dashboard", "◎"],
];

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="pwfb-shell">
      <aside className="pwfb-sidebar">
        <div className="pwfb-brand">
          <div className="pwfb-brand-mark">P</div>
          <div>
            <strong>PWFB</strong>
            <span>Microfinance</span>
          </div>
        </div>

        <div className="pwfb-access">
          <small>ACCESS</small>
          <strong>Super Admin</strong>
        </div>

        <nav className="pwfb-nav">
          {links.map(([label, href, icon]) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                className={`pwfb-nav-link ${
                  active ? "pwfb-nav-link-active" : ""
                }`}
              >
                <span className="pwfb-nav-icon">{icon}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="pwfb-sidebar-status">
          <span className="pwfb-status-dot" />
          <div>
            <strong>System Online</strong>
            <small>Production</small>
          </div>
        </div>
      </aside>

      <div className="pwfb-main">
        <header className="pwfb-topbar">
          <div>
            <strong>PWFB Microfinance</strong>
            <small>Perfect Wisdom For Better Limited</small>
          </div>

          <div className="pwfb-user">
            <div className="pwfb-user-avatar">SA</div>
            <div>
              <strong>Super Admin</strong>
              <small>Administrator</small>
            </div>
          </div>
        </header>

        <main className="pwfb-content">{children}</main>
      </div>
    </div>
  );
}
