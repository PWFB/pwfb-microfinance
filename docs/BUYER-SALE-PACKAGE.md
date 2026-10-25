# LAB MICROFINANCE SaaS — Buyer Information & Price Package

**Status:** Confidential draft for prospective buyers  
**Prepared:** 25 October 2026  
**Seller:** To be completed by the owner before publication  
**Product:** LAB MICROFINANCE / PWFB Microfinance SaaS  
**Transaction sought:** Outright software-asset acquisition; alternative commercial terms may be negotiated

> **Important:** This is a seller-prepared information pack, not an independent valuation, audited financial statement, legal opinion, or guarantee of fitness for live financial operations. All functionality, intellectual-property rights, security controls, hosting arrangements, and transfer scope must be verified during due diligence.

## 1. Executive summary

LAB MICROFINANCE is a web-based microfinance management software project intended to support workflows such as customer management, savings, loans, and transaction records. The project has a hosted web frontend, backend API, source-code repository, and PostgreSQL/Prisma database infrastructure.

The opportunity is to acquire the software foundation and continue product hardening, commercialisation, and onboarding of microfinance operators. The project should be presented as an **early-stage software asset**, not as an established financial institution or a revenue-generating SaaS business unless the seller can provide separate evidence.

## 2. Product and technical footprint

- Public application: https://pwfb-microfinance-staging.onrender.com
- Backend service: https://pwfb-backend-staging.onrender.com
- Source repository: https://github.com/PWFB/pwfb-microfinance
- Frontend framework: Next.js / React
- Backend framework: NestJS
- Data layer: PostgreSQL with Prisma ORM
- Hosting: Render
- Payment integration: Paystack is configured in **test mode**; live-money collection is not represented as operational.

The public website describes these areas:
- Customer profiles and KYC-related workflows
- Savings account workflows
- Loan applications and approvals
- Deposits, withdrawals, transfers and transaction views

Additional backend workflows and controls may exist in the codebase, but their readiness should be verified by a buyer through code review and supervised end-to-end tests. A link being online is not proof that every feature is complete or production-ready.

## 3. Current commercial position and known limitations

- No established paying-customer base or recurring SaaS revenue has been verified for this package.
- Paystack is in test mode. Test payments are not real funds and must not be marketed as live payment processing.
- Live financial operations require end-to-end acceptance testing, security review, production provider credentials and configuration, and any applicable legal/regulatory approvals.
- The seller should prepare a reproducible demo and buyer-specific test accounts without exposing real customer records or production secrets.
- Current hosting, database ownership, domain rights, provider accounts, and recurring infrastructure costs must be confirmed as part of the sale.
- Any third-party or open-source dependencies remain subject to their applicable licences.

## 4. Proposed buyer price package (NGN)

### Public asking price
**₦7,500,000 — negotiable**

This is a proposed opening ask for the software assets and agreed handover, not a market-verified appraisal. The final price depends on due diligence, precise transfer scope, ownership evidence, and the amount of post-sale support.

### Seller's internal negotiation guidance (do not publish automatically)
- **Target negotiation zone:** ₦4,500,000–₦6,000,000, subject to the buyer's scope and evidence.
- **Do not promise or imply:** verified revenue, live payment processing, regulatory approval, a customer portfolio, or fully production-ready financial workflows without evidence.
- **Do not disclose a minimum acceptable price publicly.** Decide the reserve privately after reviewing urgency, transfer scope, taxes/fees, and the value of retaining licensing rights.

These figures are commercial starting points only. They are not derived from audited revenue, market comparables, or an independent appraisal. If the owner wants a stronger valuation, gather build/replacement-cost evidence, an independent code audit, a verified feature/test report, hosting-cost history, and any genuine customer contracts or revenue records.

### What the asking price may include (must be agreed in writing)
1. Transfer or licence of the seller-owned application source code and associated project documentation.
2. A documented handover of the agreed code repository and deployment configuration.
3. Database schema and migration documentation; production data only if lawfully transferable and expressly agreed.
4. One agreed technical handover session and a defined, limited support period.
5. An inventory of third-party services and dependencies.

### Exclusions unless explicitly agreed
- The seller's personal Gmail, GitHub, Render, Neon or Paystack accounts.
- API keys, passwords, private keys, recovery codes, or credentials in plain text.
- Unrelated projects, trademarks, domains, or intellectual property not owned by the seller or not listed in the signed agreement.
- Any claim of regulated financial-institution status, licence, customer contracts, revenue, or live-payment readiness that has not been evidenced.
- Transfer of personal/customer data without lawful basis, required consent, and appropriate safeguards.

## 5. Due-diligence checklist for the buyer

Before payment or signing, both parties should document and verify:

- Seller's ownership or authority to transfer the code and all included intellectual property.
- Repository access, commit history, third-party licences, and any contributor rights.
- Build and deployment reproducibility from a clean checkout.
- Authentication, role-based permissions, administrator controls, password/session security, and audit logging.
- Customer/staff registration and approval paths.
- Savings, loan, ledger, wallet, transfer, reversal, and reconciliation behaviour as applicable.
- Duplicate-payment and duplicate-transaction protections; idempotency and webhook signature validation.
- Paystack test-mode status and the separate work required for live mode.
- Database backup/restore, migration rollback strategy, access controls, encryption in transit, secrets management, and incident recovery.
- Actual operating costs, service ownership, provider limitations, uptime evidence, and transferability.
- Legal/regulatory review required for the buyer's intended jurisdiction and business model.

**No real-money transaction should be used as a casual demo.** Use a controlled test environment until a formal acceptance plan and authorisation are in place.

## 6. Suggested transaction process

1. Seller completes identity/contact details and confirms exactly which assets are owned and included.
2. Buyer signs a confidentiality agreement if needed.
3. Seller provides a guided demo and a time-limited, non-production review environment.
4. Buyer conducts technical, legal, and commercial due diligence.
5. Both parties sign an asset purchase or licence agreement defining price, assets, exclusions, representations, support, liability, and acceptance criteria.
6. Payment is handled through an agreed, documented method; use an escrow arrangement where appropriate and available.
7. Transfer only the agreed assets, rotate/reissue credentials, revoke seller access where appropriate, and document acceptance.
8. Buyer independently provisions its own hosting, database, payment-provider account, and production secrets unless account transfer is explicitly lawful and supported.

## 7. Buyer-facing offer summary

**LAB MICROFINANCE SaaS — Software Acquisition Opportunity**

A web-based microfinance management software project is available for acquisition. The project includes a hosted web application, backend API, database infrastructure and source-code repository, with customer, savings, loan and transaction modules presented by the application.

**Proposed asking price: ₦7,500,000 (negotiable).**

The asset is at an early commercial stage. Paystack is currently configured in test mode, and no established paying-customer revenue is claimed. A serious buyer is invited to inspect the code, review the implementation, and agree a clear transfer scope and acceptance plan.

**Seller contact:** Add the owner's preferred business email and phone number before sharing publicly. Do not publish private credentials or personal account recovery information.

## 8. Seller preparation before circulating this pack

- [ ] Add a dedicated business contact email and phone number.
- [ ] Confirm whether the offer is an outright sale, exclusive licence, or non-exclusive licence.
- [ ] Prepare a short screen-recorded demo using test data only.
- [ ] Gather build/test evidence and an accurate list of incomplete features.
- [ ] Confirm intellectual-property ownership and open-source licence compliance.
- [ ] Prepare hosting-cost and service-ownership information.
- [ ] Obtain legal advice on the asset-transfer agreement and any applicable financial-services obligations.
- [ ] Remove secrets and private data from any code archive shared with a buyer.
