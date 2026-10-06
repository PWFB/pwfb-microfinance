# PWFB Pre-Sale Readiness

## Current status

PWFB is in the final hardening and verification stage. This document tracks evidence required before the software is marketed as a production-ready asset.

## Completed foundation

- Core customer, account, savings, transaction and loan modules are present.
- Banking integrations and account-name verification are implemented.
- Role-based access, organizational scope and audit controls are implemented.
- Authentication hardening includes Google identity validation, passkeys/biometrics and authenticator support.
- Paystack webhook/signature validation is implemented.
- GitHub CodeQL is enabled.

## Final gates

1. Complete the production checklist in `PRODUCTION-CHECKLIST.md`.
2. Resolve any failed financial regression tests.
3. Reconcile production URLs, Android release metadata and deployment configuration.
4. Confirm the production Android release as 1.0.51 / versionCode 51.
5. Produce buyer-facing test evidence and handover documentation.
6. Only then declare the repository Sale-Ready.

## Important

Passing CI or CodeQL does not by itself prove that financial workflows are correct. Financial balances, repayments, transfers, reversals and reconciliation must be tested end-to-end with controlled test data.
