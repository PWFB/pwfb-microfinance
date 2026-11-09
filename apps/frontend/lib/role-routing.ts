export type UserRole = "SUPER_ADMIN" | "ADMIN" | "REGIONAL_MANAGER" | "DIVISIONAL_MANAGER" | "AREA_MANAGER" | "BRANCH_MANAGER" | "LOAN_OFFICER" | "TELLER" | "AUDITOR" | "MONITORING_TEAM" | "COLLECTOR" | "CREDIT_OFFICER" | "STAFF" | "CUSTOMER";

const STAFF_ROLES = new Set<UserRole>([
  "ADMIN","REGIONAL_MANAGER","DIVISIONAL_MANAGER","AREA_MANAGER","BRANCH_MANAGER","LOAN_OFFICER","TELLER","AUDITOR","MONITORING_TEAM","COLLECTOR","CREDIT_OFFICER","STAFF",
]);

export function getDashboardPath(role?: string): string {
  if (role === "SUPER_ADMIN") return "/dashboard";
  if (role === "CUSTOMER") return "/customer-dashboard";
  if (STAFF_ROLES.has(role as UserRole)) return "/staff-dashboard";
  return "/login";
}


/**
 * Dashboard routes are role-aware, but the Staff Dashboard is also an
 * authorized workspace for Super Admin users. Do not force Super Admins
 * back to their default dashboard when they intentionally open it.
 */
export function isDashboardPathAllowed(role?: string, pathname?: string): boolean {
  if (pathname === "/dashboard") return role === "SUPER_ADMIN";
  if (pathname === "/customer-dashboard") return role === "CUSTOMER";
  if (pathname === "/staff-dashboard") {
    return role === "SUPER_ADMIN" || STAFF_ROLES.has(role as UserRole);
  }
  return true;
}
