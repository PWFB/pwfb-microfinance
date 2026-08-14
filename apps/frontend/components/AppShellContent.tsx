"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

type NavItem = {
  label: string;
  href: string;
  roles: string[];
};

type NavGroup = {
  key: string;
  label: string;
  icon: string;
  href: string;
  roles: string[];
  children: NavItem[];
};

const groups: NavGroup[] = [
  {
    key: "customers",
    label: "Customers",
    icon: "👥",
    href: "/customers",
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "LOAN_OFFICER", "TELLER"],
    children: [
      { label: "Customer Overview", href: "/customers", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "LOAN_OFFICER", "TELLER"] },
      { label: "Add Customer", href: "/customers/add", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "LOAN_OFFICER", "TELLER"] },
    ],
  },
  {
    key: "savings",
    label: "Savings",
    icon: "💰",
    href: "/savings",
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "TELLER"],
    children: [
      { label: "Savings Overview", href: "/savings", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "TELLER"] },
      { label: "Add Savings", href: "/savings/add", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "TELLER"] },
    ],
  },
  {
    key: "loans",
    label: "Loans",
    icon: "🏦",
    href: "/loans",
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "LOAN_OFFICER"],
    children: [
      { label: "Loan Overview", href: "/loans", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "LOAN_OFFICER"] },
      { label: "Add Loan", href: "/loans/add", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "LOAN_OFFICER"] },
    ],
  },
  {
    key: "repayments",
    label: "Repayments",
    icon: "↩",
    href: "/repayments",
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "LOAN_OFFICER"],
    children: [
      { label: "Repayment Overview", href: "/repayments", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "LOAN_OFFICER"] },
      { label: "Add Repayment", href: "/repayments/add", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "LOAN_OFFICER"] },
    ],
  },
  {
    key: "transactions",
    label: "Transactions",
    icon: "↔",
    href: "/transactions",
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "TELLER"],
    children: [
      { label: "Transaction Overview", href: "/transactions", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "TELLER"] },
      { label: "Add Transaction", href: "/transactions/add", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "TELLER"] },
    ],
  },
  {
    key: "staff",
    label: "Staff",
    icon: "👤",
    href: "/staff-dashboard",
    roles: ["SUPER_ADMIN", "ADMIN"],
    children: [
      { label: "Staff Dashboard", href: "/staff-dashboard", roles: ["SUPER_ADMIN", "ADMIN"] },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    icon: "📊",
    href: "/reports",
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "AUDITOR"],
    children: [
      { label: "Reports & Analytics", href: "/reports", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "AUDITOR"] },
    ],
  },
  {
    key: "branches",
    label: "Branches",
    icon: "🏢",
    href: "/branches",
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"],
    children: [
      { label: "Branch Overview", href: "/branches", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"] },
    ],
  },
];

const financeOperations: NavGroup = {
  key: "finance-operations",
  label: "Finance Operations",
  icon: "💼",
  href: "/cashbook",
  roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "LOAN_OFFICER", "TELLER", "AUDITOR"],
  children: [
    { label: "Financial Periods", href: "/periods", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "AUDITOR"] },
    { label: "Payroll & Summary", href: "/payroll", roles: ["SUPER_ADMIN", "ADMIN"] },
    { label: "Cashbook & Summary", href: "/cashbook", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "TELLER"] },
    { label: "Daily Collections & Summary", href: "/collections", roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "LOAN_OFFICER", "TELLER"] },
  ],
};

groups.push(financeOperations);

const adminTools: NavGroup = {
  key: "admin-tools",
  label: "PWFB Control Center",
  icon: "🛠️",
  href: "/api-workbench",
  roles: ["SUPER_ADMIN"],
  children: [
    { label: "API Workbench", href: "/api-workbench", roles: ["SUPER_ADMIN"] },
    { label: "System Dashboard", href: "/dashboard", roles: ["SUPER_ADMIN"] },
    { label: "Branch Management", href: "/branches", roles: ["SUPER_ADMIN"] },
    { label: "Staff & Functions", href: "/staff-dashboard", roles: ["SUPER_ADMIN"] },
    { label: "Reports & Analytics", href: "/reports", roles: ["SUPER_ADMIN"] },
  ],
};

groups.push(adminTools);

const publicRoutes = ["/", "/login", "/register"];

function isInside(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShellContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isPublicRoute = publicRoutes.includes(pathname);

  useEffect(() => {
    if (!loading && !user && !isPublicRoute) {
      router.replace("/login");
    }
  }, [loading, user, isPublicRoute, router]);

  useEffect(() => {
    const activeGroup = groups.find((group) =>
      isInside(pathname, group.href),
    );

    if (activeGroup) {
      setOpenGroup(activeGroup.key);
    }

    setMobileOpen(false);
  }, [pathname]);

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

  const visibleGroups = groups.filter((group) =>
    group.roles.includes(user.role),
  );

  return (
    <div className="pwfb-shell">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="pwfb-sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`pwfb-sidebar ${
          mobileOpen ? "pwfb-sidebar-mobile-open" : ""
        }`}
      >
        <div className="pwfb-sidebar-header">
          <Link href="/dashboard" className="pwfb-brand">
            <div className="pwfb-brand-logo">
              <span>PWFB</span>
            </div>

            <div className="pwfb-brand-text">
              <strong>PWFB</strong>
              <span>MICROFINANCE</span>
            </div>
          </Link>

          <button
            type="button"
            className="pwfb-sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="pwfb-access">
          <small>ACCESS LEVEL</small>
          <strong>{user.role.replaceAll("_", " ")}</strong>
        </div>

        <nav className="pwfb-nav">
          <Link
            href="/dashboard"
            className={`pwfb-nav-link ${
              pathname === "/dashboard" ? "pwfb-nav-link-active" : ""
            }`}
          >
            <span className="pwfb-nav-icon">⌂</span>
            <span>Dashboard</span>
          </Link>

          {visibleGroups.map((group) => {
            const active = isInside(pathname, group.href);
            const expanded = openGroup === group.key;

            const visibleChildren = group.children.filter((child) =>
              child.roles.includes(user.role),
            );

            return (
              <div key={group.key} className="pwfb-nav-group">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroup(expanded ? null : group.key)
                  }
                  className={`pwfb-nav-link pwfb-nav-parent ${
                    active ? "pwfb-nav-link-parent-active" : ""
                  }`}
                >
                  <span className="pwfb-nav-icon">{group.icon}</span>
                  <span>{group.label}</span>
                  <span className="pwfb-nav-chevron">
                    {expanded ? "⌃" : "⌄"}
                  </span>
                </button>

                {expanded && (
                  <div className="pwfb-subnav">
                    {visibleChildren.map((child) => {
                      const childActive = isInside(
                        pathname,
                        child.href,
                      );

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`pwfb-subnav-link ${
                            childActive
                              ? "pwfb-subnav-link-active"
                              : ""
                          }`}
                        >
                          <span className="pwfb-subnav-dot" />
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {user.role === "CUSTOMER" && (
            <Link
              href="/customer-dashboard"
              className={`pwfb-nav-link ${
                pathname === "/customer-dashboard"
                  ? "pwfb-nav-link-active"
                  : ""
              }`}
            >
              <span className="pwfb-nav-icon">◎</span>
              <span>Customer Portal</span>
            </Link>
          )}
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
          <div className="pwfb-topbar-left">
            <button
              type="button"
              className="pwfb-menu-button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              ☰
            </button>

            <div>
              <strong>PWFB Microfinance</strong>
              <small>Perfect Wisdom For Better Limited</small>
            </div>
          </div>

          <div className="pwfb-user">
            <div className="pwfb-user-avatar">
              {displayName.slice(0, 2).toUpperCase()}
            </div>

            <div className="pwfb-user-info">
              <strong>{displayName}</strong>
              <small>{user.role.replaceAll("_", " ")}</small>
            </div>

            <button
              type="button"
              onClick={logout}
              className="pwfb-logout-button"
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
