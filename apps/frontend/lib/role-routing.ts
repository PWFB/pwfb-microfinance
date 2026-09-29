export type UserRole = "SUPER_ADMIN" | "ADMIN" | "REGIONAL_MANAGER" | "DIVISIONAL_MANAGER" | "AREA_MANAGER" | "BRANCH_MANAGER" | "CREDIT_OFFICER" | "LOAN_OFFICER" | "TELLER" | "AUDITOR" | "MONITORING_TEAM" | "COLLECTOR" | "STAFF" | "CUSTOMER";

export function getDashboardPath(role?: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/dashboard";

    case "CREDIT_OFFICER":
    case "COLLECTOR":
    case "STAFF":
      return "/staff-field";

    case "STAFF":
    case "ADMIN":
    case "REGIONAL_MANAGER":
    case "DIVISIONAL_MANAGER":
    case "AREA_MANAGER":
    case "BRANCH_MANAGER":
    case "LOAN_OFFICER":
    case "TELLER":
    case "AUDITOR":
    case "MONITORING_TEAM":
    case "COLLECTOR":
      return "/staff-dashboard";

    case "CUSTOMER":
      return "/customer-dashboard";

    default:
      return "/login";
  }
}
