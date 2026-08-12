"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

type NavLink = {
  label: string;
  href: string;
  icon: string;
  roles: string[];
};

const links: NavLink[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "⌂",
    roles: [
      "SUPER_ADMIN",
      "ADMIN",
      "BRANCH_MANAGER",
      "LOAN_OFFICER",
      "TELLER",
      "AUDITOR",
    ],
  },
  {
    label: "Customers",
    href: "/customers",
    icon: "👥",
    roles: [
      "SUPER_ADMIN",
      "ADMIN",
      "BRANCH_MANAGER",
      "LOAN_OFFICER",
      "TELLER",
    ],
  },
  {
    label: "Savings",
    href: "/savings",
    icon: "💰",
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "TELLER"],
  },
  {
    label: "Loans",
    href: "/loans",
    icon: "🏦",
    roles: [
      "SUPER_ADMIN",
      "ADMIN",
      "BRANCH_MANAGER",
      "LOAN_OFFICER",
    ],
  },
  {
    label: "Repayments",
    href: "/repayments",
    icon: "↩",
    roles: [
      "SUPER_ADMIN",
      "ADMIN",
      "BRANCH_MANAGER",
      "LOAN_OFFICER",
    ],
  },
  {
    label: "Transactions",
    href: "/transactions",
    icon: "↔",
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "TELLER"],
  },
  {
    label: "Staff",
    href: "/staff-dashboard",
    icon: "👤",
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "📊",
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "AUDITOR"],
  },
  {
    label: "Branches",
    href: "/branches",
    icon: "🏢",
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"],
  },
  {
    label: "Customer Portal",
    href: "/customer-dashboard",
    icon: "◎",
    roles: ["CUSTOMER"],
  },
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

  const visibleLinks = links.filter((link) =>
    link.roles.includes(user.role),
  );

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
          {visibleLinks.map((link) => {
            const active =
              pathname === link.href ||
              pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`pwfb-nav-link ${
                  active ? "pwfb-nav-link-active" : ""
                }`}
              >
                <span className="pwfb-nav-icon">{link.icon}</span>
                <span>{link.label}</span>
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
