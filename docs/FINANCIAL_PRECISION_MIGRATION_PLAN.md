# LAB MICROFINANCE Financial Precision Migration Plan

## Purpose

Move financial values away from PostgreSQL floating-point storage without silently changing existing balances, breaking API consumers, or making a rollback unsafe. This document is an audit and rollout plan; it does not authorize a live database change.

## Current audit findings

The Prisma schema on `staging` contains 21 `Float` fields across 11 models that carry money or a monetary rate:

| Model | Fields | Proposed target |
| --- | --- | --- |
| `Savings` | `amount` | `Decimal(20,2)` |
| `Loan` | `amount`, `disbursementAmount` | `Decimal(20,2)` |
| `Loan` | `interestRate` | `Decimal(9,6)`, subject to confirming whether the stored unit is percent or fraction |
| `Transaction` | `amount` | `Decimal(20,2)` |
| `Repayment` | `amount` | `Decimal(20,2)` |
| `Payroll` | `totalBasic`, `totalAllowances`, `totalDeductions`, `totalNet` | `Decimal(20,2)` |
| `PayrollItem` | `basicSalary`, `allowances`, `deductions`, `netSalary` | `Decimal(20,2)` |
| `SalaryDisbursement` | `amount` | `Decimal(20,2)` |
| `CashbookEntry` | `amount` | `Decimal(20,2)` |
| `DailyCollection` | `amount` | `Decimal(20,2)` |
| `CustomerWallet` | `balance` | `Decimal(20,2)` |
| `WalletTransaction` | `amount`, `previousBalance`, `newBalance` | `Decimal(20,2)` |

The Super Admin charges wallet is also created by raw SQL in `apps/backend/src/super-admin/super-admin.service.ts` using `DOUBLE PRECISION` for `pwfb_admin_wallet.balance`, `pwfb_admin_wallet_transactions.amount`, `previousBalance`, and `newBalance`. That schema must be included in the audit even though it is not represented by the Prisma models listed above.

This inventory was derived from the repository schema and source.

## Read-only Neon preflight observed on 2026-10-25

A read-only inspection was run against the Neon project named `Pwfb-microfinance`, its default `production` branch, and database `neondb`. Metadata showed:

- `User`: 4 rows.
- `Customer`, `Staff`, `CustomerWallet`, and `WalletTransaction`: 0 rows each.
- The 20 inspected monetary columns across savings, loan amounts/disbursement, transactions, repayments, payroll, salary disbursements, cashbook, collections, customer wallets, and wallet ledger had 0 rows. The loan interest-rate field was excluded from monetary rounding checks because it has a different precision policy.
- The expected Super Admin wallet tables `pwfb_admin_wallet` and `pwfb_admin_wallet_transactions` were not present on that branch at the time of the check, despite raw SQL in the source being capable of creating them later.

Because those financial tables are empty, the read-only check found no existing monetary values to round in this specific Neon branch. This is **not yet proof that the deployed Render service points at the same branch/database**; do not infer that from project name alone. Before migration, confirm the staging/production `DATABASE_URL` target without printing credentials and rerun the audit on that exact target. Do not expose or log connection strings.

The table `public._prisma_migrations` was not present in this inspected database. The repository's `apps/backend/scripts/migrate-deploy.js` checks for this condition and, when existing tables are detected without migration history, records eight listed legacy migrations as applied before running `prisma migrate deploy`. That bootstrap behavior needs to be reviewed for the exact target database before the new precision migration is released; the new migration must not be added under an assumption that the database already has normal Prisma migration history.

This is a read-only snapshot, not a backup or migration test. It does not confirm the database connection configured in Render, whether this branch is the actual deployed `DATABASE_URL` target, or whether another project/branch contains financial records.

## Decisions before implementation

1. Use PostgreSQL `NUMERIC(20,2)` / Prisma `Decimal @db.Decimal(20,2)` for NGN amounts, balances and ledger before/after values, subject to confirming business maximums and current column definitions.
2. Keep rates such as loan interest separate from currency amounts. Confirm the existing unit and business precision before choosing the column scale.
3. Preserve API contracts intentionally. Prisma Decimal values must not leak as unexpected string values or be used in JavaScript `+`, `-`, or comparison operations without a deliberate conversion strategy.
4. Do not bulk-replace every `Float` in the schema. Fields that represent ratios, scores, coordinates, or non-money measurements need separate treatment.

## Required preflight checks

Run these against a backed-up staging database first, then use the same checks and reviewed thresholds before production:

- Verify migration history and deployed schema match the checked-in Prisma migration history.
- Inventory every affected table and column, including the dynamically created Super Admin tables and raw SQL paths.
- Record row counts, null counts, minimum/maximum values, negative balances, and high-precision residues for each affected amount column.
- Compare existing values with their two-decimal rounded values and quantify the total absolute difference. Investigate any row whose difference exceeds the agreed rounding tolerance; do not silently round away unexplained residuals.
- Check duplicate or reused payment references and whether ledger entries reconcile to balances.
- Confirm foreign keys, unique constraints, indexes, and defaults will survive the type change.
- Confirm the exact backup/restore process and recovery window for the Neon database; record the migration owner and approval before execution.

## Implementation phases

### Phase 1 — wallet ledger and customer balances

Scope: `CustomerWallet.balance` and `WalletTransaction.amount`, `previousBalance`, `newBalance`.

1. Update all wallet balance writers and readers before changing the Prisma types. Current critical writers include ordinary banking deposits/withdrawals/transfers, Paystack wallet deposits and transfer reversals, customer virtual-account webhook deposits, outbound bank transfers and their reversals, and legacy withdrawal reconciliation.
2. Introduce one well-tested money conversion/calculation helper and use it consistently; avoid mixing raw JavaScript arithmetic with Prisma Decimal values.
3. Normalize API output explicitly and test all frontend/read/report consumers for number-versus-string expectations.
4. Add migration SQL using explicit casts and reviewed rounding semantics. Do not run it until preflight results are accepted.
5. Validate balances and ledger before/after values, duplicate webhook idempotency, concurrent deposits, concurrent withdrawals, opposite-direction transfers, wallet suspension, and withdrawal reversals under database-backed tests.

### Phase 2 — operations and lending

Migrate `Transaction`, `Savings`, `Loan.amount`, `Loan.disbursementAmount`, `Repayment`, `CashbookEntry`, and `DailyCollection`. Update collections, loan schedules, repayment calculations, reporting aggregates, reconciliation, and exports in the same release. Confirm loan interest unit and rounding policy independently.

### Phase 3 — payroll and admin charges

Migrate `Payroll`, `PayrollItem`, `SalaryDisbursement`, plus raw-SQL `pwfb_admin_wallet` tables. Check salary calculations, deductions, net totals, admin fee transactions, and reports. Ensure raw SQL DDL is changed as well as Prisma schema/migrations.

## Migration and rollback rules

- Use a uniquely timestamped Prisma migration under `apps/backend/prisma/migrations/` and update `schema.prisma` in the same reviewed change.
- The `USING` expression for each column must be explicit and agreed (normally a numeric cast followed by rounding to two decimals for amount fields); do not apply it before the residue audit.
- Test the exact migration against a recent sanitized staging backup and measure table rewrite/lock duration before scheduling production.
- Take and verify a restorable backup before running the migration. Keep a copy of the before/after row-level validation report.
- If application rollback is needed after the database has moved to numeric columns, prefer a compatible application rollback. Converting values back to floating-point is not a lossless precision rollback and must not be presented as one.
- Never execute a production/Neon migration based only on CI or schema validation.

## Acceptance criteria

- Prisma schema validation, backend type-check/build, backend tests, frontend tests/build, and Docker build pass.
- No remaining raw arithmetic on Prisma Decimal objects in affected code paths.
- JSON/API monetary field shape is documented and tested.
- Reconciliation passes: wallet balance equals the latest ledger balance within the defined policy; transfer OUT and IN entries match; transaction previous/new balances line up.
- Database-backed concurrent tests prove that simultaneous money movements do not overwrite or duplicate balances.
- Preflight, backup verification, migration, post-migration audit and rollback owner are signed off before any production change.

## Current related work

- PR #83 (Paystack checkout wallet-row lock): merged with CI passing.
- PR #84 (ordinary deposits, withdrawals and transfers): open draft; CI was reported successful, but it has not been merged.
- PR #86 (webhook deposits, withdrawal reconciliation and external bank-transfer lock): merged with CI passing.

None of these PRs proves the financial precision migration has been run or that a live payment has been tested.
