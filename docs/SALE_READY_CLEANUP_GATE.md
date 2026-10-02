# PWFB Microfinance — Sale-Ready Cleanup Gate

This document is the release gate for the PWFB Sale-Ready Edition. The application is not considered ready for sale until every required gate below is verified.

## 1. Repository and root
- [ ] One canonical root workflow builds backend and frontend.
- [ ] Root `npm ci` succeeds from a clean checkout.
- [ ] Root `npm run check` succeeds.
- [ ] No duplicate application source is retained without a documented reason.
- [ ] No development secrets, credentials, generated artifacts, or local databases are committed.

## 2. Backend
- [ ] `npm run build:backend` succeeds.
- [ ] `npm run test:backend` succeeds.
- [ ] `/health` returns HTTP 200 in the deployed service.
- [ ] Production JWT secret is mandatory.
- [ ] CORS is restricted to approved origins.
- [ ] Authentication, authorization, passkey, Google login, and 2FA paths are tested.
- [ ] Sensitive values are never returned in API responses.

## 3. Frontend
- [ ] `npm run build:frontend` succeeds.
- [ ] `npm run test:frontend` succeeds.
- [ ] Login modes route to the correct portal.
- [ ] Customer portal workflows are complete.
- [ ] Staff/admin/super-admin controls respect permissions.
- [ ] No dead links, placeholder screens, or broken navigation remain.

## 4. Database
- [ ] Prisma schema validates and formats cleanly.
- [ ] Schema and live production database are reconciled before release.
- [ ] Required indexes and uniqueness constraints are reviewed.
- [ ] Financial amounts and balance calculations are reviewed for precision and consistency.
- [ ] Runtime-created tables are moved to controlled schema/migration ownership where practical.

## 5. Core business workflows
- [ ] Customer → Account → Deposit → Withdrawal → Transfer.
- [ ] Customer → Loan → Approval → Disbursement → Repayment → Outstanding balance.
- [ ] Staff → Client → Payment type → Cash/Deposit → Amount → Date → Reconciled/Pending.
- [ ] Credit Officer → Loan → Branch Manager review/edit → Outstanding clients.
- [ ] ATM card and virtual-account banking flow.

## 6. Android
- [ ] Production API connectivity works without DNS/session errors.
- [ ] Staff and Customer login work.
- [ ] Google sign-in works with the correct server audience.
- [ ] Passkey/biometric flow works.
- [ ] Logout clears web and native session state.
- [ ] Pull-to-refresh works where intended.
- [ ] Versioned signed APK and AAB build successfully.
- [ ] Release signing secrets never enter the repository.

## 7. Deployment
- [ ] Render builds from the committed root lockfile.
- [ ] Backend health check is green.
- [ ] Frontend production build is green.
- [ ] Environment variables are documented and production values are configured outside Git.
- [ ] CI passes before a production deployment.

## 8. Buyer package
- [ ] Production Web App.
- [ ] Android APK/AAB.
- [ ] Backend/API.
- [ ] Database/schema and migration instructions.
- [ ] Deployment configuration.
- [ ] Technical documentation.
- [ ] API documentation.
- [ ] User manual.
- [ ] Admin manual.
- [ ] Installation guide.
- [ ] Architecture diagram.
- [ ] Security documentation.
- [ ] Feature list.
- [ ] Demo account procedure.
- [ ] Business/financial model.
- [ ] Intellectual-property transfer package.

## Release rule
Do not advertise or sell the current repository as a finished production system until this gate is complete and the final release candidate has passed the complete test matrix.
