# PWFB Production Checklist

## Release gate

- [ ] Production frontend URL verified: https://pwfb-microfinance-1.onrender.com
- [ ] Production API URL verified: https://pwfb-backend.onrender.com
- [ ] GitHub Actions build is green for the release commit
- [ ] CodeQL is green for the release commit
- [ ] No unresolved critical/high security findings remain
- [ ] Production environment variables reviewed and secrets excluded from Git
- [ ] Database migrations/schema verified against production
- [ ] Backup and recovery procedure verified

## Financial workflow regression

- [ ] Customer creation and search
- [ ] Account creation
- [ ] Deposit
- [ ] Withdrawal
- [ ] Internal transfer
- [ ] Bank transfer/account-name verification
- [ ] Loan creation
- [ ] Loan approval
- [ ] Loan disbursement
- [ ] Repayment
- [ ] Principal/interest allocation
- [ ] Outstanding balance calculation
- [ ] Reversal/adjustment
- [ ] Reconciliation and audit trail

## Access and security

- [ ] Super Admin access
- [ ] Staff access
- [ ] Customer access
- [ ] Role/permission boundaries
- [ ] Organizational scope boundaries
- [ ] Logout/session invalidation
- [ ] Google authentication
- [ ] Passkey/biometric flow
- [ ] TOTP/authenticator flow
- [ ] Paystack webhook/signature validation
- [ ] Audit logging

## Android release

- [ ] Version is 1.0.51 / versionCode 51
- [ ] Signed APK tested on a physical device
- [ ] Signed AAB generated
- [ ] Login/logout tested
- [ ] Refresh behavior tested
- [ ] API connectivity tested
- [ ] Deep links/TWA verified
- [ ] Digital Asset Links verified
- [ ] Play Console declarations prepared

## Buyer handover

- [ ] System overview
- [ ] Architecture documentation
- [ ] Database/schema documentation
- [ ] API documentation
- [ ] Security documentation
- [ ] Deployment guide
- [ ] Operations manual
- [ ] Admin/user manual
- [ ] Test evidence
- [ ] Known limitations
- [ ] IP/ownership and transfer package
- [ ] Final buyer demo environment
