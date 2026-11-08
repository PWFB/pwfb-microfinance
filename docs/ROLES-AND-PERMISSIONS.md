# PWFB Microfinance — Roles and Permissions

## Organizational hierarchy

PWFB supports multiple instances of every management role. Roles are assigned
through an organizational scope rather than being globally unique.

The hierarchy is:

**PWFB → Region → Division → Area → Branch → Staff assignment**

Examples:

- Region 1 → Regional Manager → Divisional Managers → Area Managers → Branch Managers → Credit Officers
- Region 2 → Regional Manager → Divisional Managers → Area Managers → Branch Managers → Credit Officers
- Region 3 and additional regions can be created without changing the system.

The same role can be assigned to many staff members at the same time and in
different regions, divisions, areas or branches.

## Supported roles

- Super Admin
- Admin
- Regional Manager
- Divisional Manager
- Monitoring Team
- Auditor
- Area Manager
- Branch Manager
- Credit Officer
- Teller
- Loan Officer
- Customer

## Scope rules

- Super Admin and Admin have institution-wide visibility.
- Regional Manager sees the assigned region and its subordinate organization.
- Divisional Manager sees the assigned division and its subordinate areas and branches.
- Area Manager sees the assigned area and its branches.
- Branch Manager sees the assigned branch and its staff and operations.
- Credit Officer sees the customers and loan work assigned to them.
- Monitoring Team and Auditor receive monitoring/read-oriented access within their assigned scope.

A staff member does not receive edit authority merely because they can view a
record. Editing must be controlled by role plus active organizational
assignment.

## Assignment history

Every staff member can have multiple assignments over time. When a staff
member changes role or moves to another region/branch:

1. The previous assignment is closed with an end date.
2. A new active assignment is created.
3. The staff member's current organizational scope is updated.
4. Previous work remains historically attributable to the old assignment.

This prevents reassignment from destroying historical responsibility.

## Super Admin

The Super Admin is the highest administrative access level in the platform.

Super Admin can create regions, divisions and areas, create staff in any
supported role, assign staff to organizational scopes, view assignment history,
and oversee the complete institution.

## Least privilege

Users should receive the minimum permissions required for their current role
and active assignment. Financial operations and record modification require
appropriate role and scope authorization.

---

**PWFB Microfinance**

Perfect Wisdom for Better Ltd.
