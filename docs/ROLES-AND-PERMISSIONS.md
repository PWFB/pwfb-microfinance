# PWFB Microfinance — Roles and Permissions

## 1. Purpose

This document defines the administrative access model for the PWFB
Microfinance platform.

Access should be granted according to operational responsibilities and follow
the principle of least privilege.

## 2. Super Admin

The Super Admin is the highest administrative access level in the platform.

Responsibilities include:

- System administration.
- Staff and access oversight.
- Customer management.
- Savings operations.
- Loan operations.
- Repayment operations.
- Transaction oversight.
- Staff administration.
- Reports and analytics.
- Branch administration.
- Finance Operations.
- PWFB Control Center.
- Production system oversight.

Super Admin access should only be assigned to trusted personnel with
institution-level administrative responsibility.

## 3. Staff Access

Staff members should receive access appropriate to their assigned duties.

Operational responsibilities may include:

- Customer Service.
- Savings.
- Loans.
- Repayments.
- Teller Operations.
- Finance and Accounts.
- Reports and Analytics.
- Branch Operations.
- Risk and Compliance.
- Human Resources.
- Monitoring.
- Administration.

A staff member should not receive permissions that are not required for their
role.

## 4. Customer Access

Customers are separate from internal administrative staff.

Customer access must not expose:

- Staff administration.
- Internal reports.
- System configuration.
- Other customers' records.
- Internal financial controls.
- PWFB Control Center.
- Administrative dashboards.

## 5. Module Access

| Module | Super Admin | Authorized Staff |
|---|---|---|
| Dashboard | Full | According to role |
| Customers | Full | Customer Service |
| Savings | Full | Savings |
| Loans | Full | Loans |
| Repayments | Full | Repayments |
| Transactions | Full | Authorized personnel |
| Staff | Full | Restricted |
| Reports | Full | According to role |
| Branches | Full | Branch permissions |
| Finance Operations | Full | Finance permissions |
| PWFB Control Center | Full | Restricted |

## 6. Least Privilege

Users should receive the minimum permissions required to perform their work.

For example:

- A teller should not automatically receive staff-administration access.
- A loan officer should not automatically receive finance-control access.
- A customer-service employee should not automatically receive system
  configuration access.
- A reporting user should not automatically receive transaction-editing
  permissions.

## 7. Financial Permissions

Financial operations require additional controls.

Permissions involving:

- Deposits.
- Withdrawals.
- Transfers.
- Loan creation.
- Loan modification.
- Repayment recording.
- Transaction modification.

should only be available to appropriately authorized personnel.

## 8. Administrative Responsibilities

The Super Admin should periodically review:

- Active users.
- Staff roles.
- Access permissions.
- Inactive users.
- Branch assignments.
- Administrative activity.
- Financial activity.
- Security events.

## 9. Access Review

Access should be reviewed whenever:

- A staff member changes role.
- A staff member changes department.
- A staff member leaves the organization.
- A new branch is created.
- Responsibilities change.
- A security incident occurs.

Access that is no longer required should be removed promptly.

## 10. Account Security

Administrative users should:

- Keep credentials confidential.
- Never share passwords.
- Use strong passwords.
- Sign out of shared devices.
- Avoid saving credentials on public devices.
- Report suspicious activity.
- Use authorized devices and networks where possible.

## 11. Production Principle

Production access must be limited to authorized personnel.

Development credentials, test accounts and temporary access must not be used
as permanent production credentials.

---

**PWFB Microfinance**

Perfect Wisdom for Better Ltd.
