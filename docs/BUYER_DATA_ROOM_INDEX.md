# LAB MICROFINANCE — Buyer Data Room Index

**Purpose:** Organize a complete software-asset sale without exposing secrets or personal data.  
**Commercial status:** Pre-revenue; no paying customers or recurring revenue established in the information reviewed.

## Public project references

- Product: LAB MICROFINANCE
- Current repository reference: https://github.com/PWFB/pwfb-microfinance
- Staging frontend reference: https://pwfb-microfinance-staging.onrender.com
- Staging backend reference: https://pwfb-backend-staging.onrender.com

Some infrastructure and repository identifiers still use the legacy PWFB name. This is disclosed and should be reviewed before closing.

## Data-room folders

| Folder | Contents | Sharing rule |
|---|---|---|
| 01 — Overview | Executive summary, asset scope, architecture diagram, known limitations | Share after initial buyer qualification |
| 02 — Deployment | Sanitized Render deployment evidence, service settings summary, deployment instructions | Never include environment variable values or secrets |
| 03 — Product demo | Redacted demo walkthrough, synthetic test accounts, screenshots of key modules | No real customer data |
| 04 — QA evidence | Completed sale-readiness checklist, sanitized test results, issue register | Unpassed tests remain clearly marked |
| 05 — Architecture | Frontend/backend overview, API route map, database schema overview | Remove credentials and sensitive endpoints if needed |
| 06 — Security | Dependency scan, authorization test results, secret-handling review, incident disclosure if applicable | Do not claim an audit unless one was performed |
| 07 — Data and recovery | Migration status, backup/restore evidence, retention/deletion plan | Do not include production database dumps |
| 08 — IP and licences | Contributor/IP assignment evidence, third-party notices, dependency licence inventory, asset ownership | Legal review recommended |
| 09 — Commercial | Asset-sale terms, exclusions, support/handover proposal, price rationale | Share with qualified buyers |
| 10 — Closing | Assignment agreement, transfer checklist, credentials-rotation plan, acceptance record | Restricted to parties and advisers |

## Required before a buyer can rely on the asset

- [ ] Complete critical workflow test records in `docs/SALE_READINESS_CHECKLIST.md`.
- [ ] Reconcile actual Render configuration with `render.yaml`.
- [ ] Audit remaining PWFB-facing branding and domain references.
- [ ] Confirm seller authority and ownership of source code, designs, logos, and contributed work.
- [ ] Review third-party licences and identify non-transferable services.
- [ ] Establish what is included/excluded: repository, domain, hosting, database, payment-provider accounts, support, and IP assignment.
- [ ] Prepare a sanitized demo environment and rotate any demo credentials before sharing.
- [ ] Obtain legal review of the asset-sale agreement and applicable privacy/financial-services obligations.

## Explicit exclusions unless separately agreed and transferable

- Live payment-provider accounts, API keys, or bank accounts.
- Production credentials, secrets, personal data, or customer records.
- Hosting accounts or subscriptions that the provider does not permit to be transferred.
- Any regulated licence or authorization not owned by the seller and legally transferable.
- Revenue, customers, regulatory approval, security certification, or operational guarantees not supported by evidence.

## Buyer disclosure

The project has a web frontend and backend, and the latest known staging deployment records showed successful startup. End-to-end verification of identity/KYC, bank-account verification, virtual-account assignment, and financial transaction flows remains a diligence requirement. The project is pre-revenue and should be evaluated as a software asset, not as a profitable or independently audited financial institution.
