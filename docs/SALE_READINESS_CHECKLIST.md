# LAB MICROFINANCE — Sale-Readiness Verification Checklist

**Status:** Prepared for controlled staging verification  
**Environment:** Render staging only  
**Policy:** Do not use real customer data, production payment credentials, or real money. Do not mark a test passed without captured evidence.

## Current evidence baseline

- Latest previously inspected staging frontend and backend deployment records were marked live.
- Backend startup logs showed the NestJS application starting; frontend logs showed Next.js ready.
- The latest previously inspected deployment commit was `f622ec8eb7b79ef9d0f984f8d1ddac17899aed74`.
- Startup evidence does **not** establish end-to-end workflow correctness.
- Full end-to-end tests are not yet evidenced by this checklist.

## Wallet modules to verify

The source includes three distinct wallet areas:

1. **Customer Wallet** — customer balance, transaction history, and deposit/withdraw/transfer journeys.
2. **Staff Wallet** — field cash issued to staff and returned/settled, with staff wallet transactions.
3. **Super Admin Charges Wallet** — records administrative charges/fee income and associated transactions.

Treat these as three implemented wallet areas in the codebase, not as proof that all wallet flows have passed end-to-end testing. Add wallet-specific evidence for role access, balance updates, transaction history, duplicate submissions, failed operations, reconciliation, and auditability. Do not use real money or production credentials during testing.

## Static code-review findings — wallet controls

These findings come from source inspection only. They are not live penetration-test results and must be confirmed with targeted tests before being marked resolved.

- **Staff Wallet authorization scope:** the controller allows multiple roles, including `STAFF`, on the controller and exposes list, individual-wallet, history, issue, and settle routes. The inspected controller does not show per-staff ownership or branch-scope checks. Verify that guards/services enforce the intended boundaries; otherwise restrict wallet administration to authorized roles and enforce branch/staff scope server-side.
- **Staff Wallet transaction atomicity:** the controller calls `credit` and `debit` without passing a transaction client. In that path, the service performs `SELECT ... FOR UPDATE`, balance update, and transaction insertion through the normal Prisma client rather than one explicit database transaction. The row lock may not protect the later statements across separate autocommit operations. Wrap the complete read/lock/update/insert sequence in a single database transaction and add concurrent-operation tests before relying on balances.
- **Staff Wallet references and precision:** the inspected service does not enforce uniqueness for optional transaction references and does not round amounts to currency precision in the same way as the admin charges wallet. Decide and test the required idempotency/reference policy and currency rounding rules.
- **Super Admin Charges Wallet:** its controller is guarded by JWT and the `SUPER_ADMIN` role, and its charge operation uses a database transaction and row lock. Still test duplicate references, simultaneous charges, input validation, and reconciliation; these code patterns alone do not establish end-to-end correctness.

**Required evidence to close these items:** tests for cross-staff and cross-branch access, concurrent issue/settle operations, database failure between balance update and transaction insertion, duplicate references, and before/after balance reconciliation. Use staging and synthetic records only; do not use real funds or production secrets.

## Staff Wallet safety change in review

A separate code branch now wraps direct staff-wallet issue and settlement calls in a Prisma database transaction so the row lock, balance update, and ledger insert share one transaction. A focused service test file was added for direct-credit transaction use and insufficient-balance settlement rejection. These tests have been authored but have **not yet been executed** in CI or locally.

As a temporary containment measure, the Staff Wallet controller is restricted to `SUPER_ADMIN` and `ADMIN` roles while branch/staff-scoped authorization is designed and verified. This intentionally reduces access for branch managers and other staff roles until safe scope checks are implemented. Do not merge or deploy without reviewing this product-access tradeoff and running the backend test/build suite.

## Test execution record

For every test, record date/time (UTC), tester, deployment commit, environment, sanitized evidence reference, actual result, and PASS/FAIL/BLOCKED. Never include BVNs, passwords, tokens, bank account numbers, or provider secrets in evidence.

| ID | Workflow | Safe test | Expected result | Current status |
|---|---|---|---|---|
| KYC-01 | Customer KYC | Use a dedicated synthetic test user and supported test/sandbox path | Pending/verified/rejected state is explicit; no false success | NOT YET VERIFIED |
| BVN-01 | Staff BVN verification | Use provider-supported test data only; otherwise inspect mocked/unit tests | Valid signed callback updates the matching request; invalid signature is rejected | NOT YET VERIFIED |
| BVN-02 | BVN pending/failure | Simulate pending, failure, timeout, and retry responses | UI explains pending/failure and allows safe retry; no false verification | NOT YET VERIFIED |
| BANK-01 | Bank account verification | Use sandbox/test credentials and documented test account data | Verify action calls backend and shows verified, failed, or pending result | NOT YET VERIFIED |
| BANK-02 | Invalid bank details | Submit invalid test account number/bank combination | Clear validation error; no account marked verified | NOT YET VERIFIED |
| DVA-01 | Approved customer virtual account | Use test provider configuration and a dedicated test customer | Account is assigned only when eligibility/consent requirements pass; status is visible | NOT YET VERIFIED |
| DVA-02 | Staff virtual account | Use a dedicated test staff profile and supported test path | Assignment is linked to the correct staff record and is not duplicated | NOT YET VERIFIED |
| DVA-03 | Provider error | Simulate missing email, provider timeout, and provider rejection | Failure/pending reason is recorded; no fabricated account details | NOT YET VERIFIED |
| PAY-01 | Paystack webhook signature | Send a provider-approved test webhook with a valid signature, then an invalid signature | Valid event is accepted; invalid signature is rejected | NOT YET VERIFIED |
| PAY-02 | Duplicate event | Replay the same successful test event | Exactly one financial effect and one canonical transaction record | NOT YET VERIFIED |
| PAY-03 | Payment verification | Verify a test payment twice and attempt wrong-user access | Only verified successful payment credits the correct owner once | NOT YET VERIFIED |
| PAY-04 | Failed/reversed payment | Simulate failed, pending, and reversed provider outcomes | No credit for non-success; reversal follows documented ledger policy | NOT YET VERIFIED |
| AUTH-01 | Role access | Test customer, staff, admin, and super-admin test accounts | Each role can access only authorized routes/data | NOT YET VERIFIED |
| TX-01 | Transaction integrity | Test duplicate requests, invalid amounts, and insufficient funds where applicable | Atomic, consistent balance/history; failures do not leave partial updates | NOT YET VERIFIED |
| DB-01 | Migration | Run migration status against an isolated staging/test database | Migrations are repeatable and match current schema | NOT YET VERIFIED |
| DB-02 | Backup/restore | Restore a sanitized backup to an isolated database | Restore procedure works and is documented | NOT YET VERIFIED |
| DEP-01 | Reproducible deployment | Compare checked-in Render config with actual staging service settings | Root directories, build/start commands, health checks, and environment expectations are documented and consistent | OPEN — CONFIGURATION DIFF PREVIOUSLY OBSERVED |
| BRAND-01 | LAB branding | Inspect public home, login, dashboards, emails, app metadata, and Android package | User-facing brand says LAB MICROFINANCE; legacy identifiers are inventoried and intentional | PARTIAL — CODE INVENTORY NEEDED |

## Release/sale gate

Do not describe the software as production-ready until critical KYC, bank verification, DVA, payment integrity, authorization, and deployment tests have passed with repeatable evidence. If provider sandbox functionality is unavailable, record the workflow as BLOCKED rather than PASS.

## Evidence folder structure

Store sanitized artifacts in a restricted buyer data room:
- `01-deployment/`
- `02-brand-audit/`
- `03-kyc-bank-verification/`
- `04-virtual-accounts/`
- `05-payments-ledger/`
- `06-security-access/`
- `07-database-recovery/`
- `08-legal-ip-licences/`

Do not store credentials, full personal identifiers, live account data, or raw customer documents in the buyer room.
