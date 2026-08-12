"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const links = [
  ["Dashboard", "/dashboard", "⌂"],
  ["Customers", "/customers", "👥"],
  ["Savings", "/savings", "💰"],
  ["Loans", "/loans", "🏦"],
  ["Repayments", "/repayments", "↩"],
  ["Transactions", "/transactions", "↔"],
  ["Staff", "/staff-dashboard", "👤"],
  ["Reports", "/reports", "📊"],
  ["Branches", "/branches", "🏢"],
  ["Customer Portal", "/customer-dashboard", "◎"],
];

const publicRoutes = ["/", "/login", "/register"];

export default function AppShellContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const isPublicRoute = publicRoutes.includes(pathname);

  useEffect(() => {
    if (!loading && !user && !isPublicRoute) {
      router.replace("/login");
    }
  }, [loading, user, isPublicRoute, router]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-emerald-700">Checking authentication...</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email;

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
          <strong>{user.role.replaceAll("_", " ")}</strong>
        </div>

        <nav className="pwfb-nav">
          {links.map(([label, href, icon]) => {
            const active =
              pathname === href ||
              pathname.startsWith(`${href}/`);

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
            <div className="pwfb-user-avatar">
              {displayName.slice(0, 2).toUpperCase()}
            </div>

            <div>
              <strong>{displayName}</strong>
              <small>{user.role.replaceAll("_", " ")}</small>
            </div>

            <button
              type="button"
              onClick={logout}
              className="ml-3 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="pwfb-content">{children}</main>
      </div>
    </div>
  );
}
