export type UserRole = "SUPER_ADMIN" | "STAFF" | "CUSTOMER";

export function getDashboardPath(role?: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/dashboard";

    case "STAFF":
      return "/staff-dashboard";

    case "CUSTOMER":
      return "/customer-dashboard";

    default:
      return "/login";
  }
}
