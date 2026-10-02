-- Sale-ready cleanup: move runtime-created tables under migration ownership.
-- Existing deployments may already contain these tables; IF NOT EXISTS keeps this migration additive.

CREATE TABLE IF NOT EXISTS "CustomerAtmCard" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE,
  "cardholderName" TEXT NOT NULL,
  "last4" TEXT NOT NULL,
  "cardNetwork" TEXT,
  "expiryMonth" INTEGER,
  "expiryYear" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "providerAuthorizationCode" TEXT,
  "frontImage" BYTEA,
  "frontMimeType" TEXT,
  "backImage" BYTEA,
  "backMimeType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerAtmCard_customerId_idx" ON "CustomerAtmCard"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerAtmCard_status_idx" ON "CustomerAtmCard"("status");

CREATE TABLE IF NOT EXISTS "GoogleIdentity" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "googleSub" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "UserAuthenticator" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "secretEnc" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "recoveryCodes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "UserTwoFactorSession" (
  "tokenHash" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "verifiedUntil" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "UserTwoFactorSession_userId_idx" ON "UserTwoFactorSession"("userId");
CREATE INDEX IF NOT EXISTS "UserTwoFactorSession_verifiedUntil_idx" ON "UserTwoFactorSession"("verifiedUntil");

CREATE TABLE IF NOT EXISTS "PWFBLoanRate" (
  "id" TEXT PRIMARY KEY,
  "loanType" TEXT NOT NULL UNIQUE,
  "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PWFBLoanMeta" (
  "loanId" TEXT PRIMARY KEY REFERENCES "Loan"("id") ON DELETE CASCADE,
  "loanType" TEXT,
  "duration" DOUBLE PRECISION,
  "repaymentFrequency" TEXT,
  "purpose" TEXT,
  "interestAmount" DOUBLE PRECISION,
  "totalRepayment" DOUBLE PRECISION,
  "installmentAmount" DOUBLE PRECISION,
  "passportPhoto" TEXT,
  "disbursementDestination" TEXT,
  "verifiedNameMatchCount" DOUBLE PRECISION,
  "disbursementAccountVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PWFBRepaymentAllocation" (
  "repaymentId" TEXT PRIMARY KEY REFERENCES "Repayment"("id") ON DELETE CASCADE,
  "principalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "interestPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_identity_verifications (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE REFERENCES "Customer"(id) ON DELETE CASCADE,
  bvn TEXT,
  bvn_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED',
  bvn_verified_at TIMESTAMP,
  bvn_overridden_at TIMESTAMP,
  bvn_override_by_user_id TEXT,
  bvn_override_by_email TEXT,
  bvn_override_reason TEXT,
  nin TEXT,
  nin_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED',
  nin_verified_at TIMESTAMP,
  nin_overridden_at TIMESTAMP,
  nin_override_by_user_id TEXT,
  nin_override_by_email TEXT,
  nin_override_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS customer_identity_override_audits (
  id TEXT PRIMARY KEY,
  verification_id TEXT NOT NULL REFERENCES customer_identity_verifications(id) ON DELETE CASCADE,
  identity_type TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  admin_user_id TEXT NOT NULL,
  admin_email TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customer_identity_override_audits_verification_idx ON customer_identity_override_audits(verification_id);
CREATE INDEX IF NOT EXISTS customer_identity_override_audits_admin_idx ON customer_identity_override_audits(admin_user_id);

INSERT INTO "PWFBLoanRate" ("id","loanType","interestRate")
VALUES
  ('rate_loan','Loan',0),
  ('rate_daily_loan','Daily Loan',0),
  ('rate_weekly_loan','Weekly Loan',0),
  ('rate_individual_loan','Individual Loan',0),
  ('rate_monthly_loan','Monthly Loan',0)
ON CONFLICT ("loanType") DO NOTHING;
