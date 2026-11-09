export type UserRole = "SUPER_ADMIN" | "ADMIN" | "REGIONAL_MANAGER" | "DIVISIONAL_MANAGER" | "AREA_MANAGER" | "BRANCH_MANAGER" | "LOAN_OFFICER" | "TELLER" | "AUDITOR" | "MONITORING_TEAM" | "COLLECTOR" | "CREDIT_OFFICER" | "STAFF" | "CUSTOMER";

const STAFF_ROLES = new Set<UserRole>([
  "ADMIN","REGIONAL_MANAGER","DIVISIONAL_MANAGER","AREA_MANAGER","BRANCH_MANAGER","LOAN_OFFICER","TELLER","AUDITOR","MONITORING_TEAM","COLLECTOR","CREDIT_OFFICER","STAFF",
]);

// Super Admins are explicitly offered the Staff Dashboard in the sidebar as well.
const STAFF_DASHBOARD_ROLES = new Set<UserRole>(["SUPER_ADMIN", ...STAFF_ROLES]);

export function getDashboardPath(role?: string): string {
  if (role === "SUPER_ADMIN") return "/dashboard";
  if (role === "CUSTOMER") return "/customer-dashboard";
  if (STAFF_ROLES.has(role as UserRole)) return "/staff-dashboard";
  return "/login";
}

/**
 * Check whether a user may remain on a dashboard route.
 * The default dashboard is a landing page, not an exclusive route:
 * Super Admins may also open the Staff Dashboard from Organization.
 */
export function canAccessDashboardPath(role?: string, pathname?: string): boolean {
  if (pathname === "/staff-dashboard") {
    return STAFF_DASHBOARD_ROLES.has(role as UserRole);
  }
  return Boolean(pathname) && pathname === getDashboardPath(role);
}
