-- Consolidate application-startup DDL into the migration history.
-- IF NOT EXISTS keeps the migration compatible with databases where older
-- application versions created these tables dynamically at runtime.

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
CREATE INDEX IF NOT EXISTS "UserTwoFactorSession_user_verified_idx"
  ON "UserTwoFactorSession" ("userId", "verifiedUntil");

CREATE TABLE IF NOT EXISTS "StaffBvnVerification" (
  "id" TEXT PRIMARY KEY,
  "reference" TEXT NOT NULL UNIQUE,
  "bvnHash" TEXT,
  "requestedFirstName" TEXT NOT NULL,
  "requestedLastName" TEXT NOT NULL,
  "firstName" TEXT,
  "middleName" TEXT,
  "lastName" TEXT,
  "fullName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3)
);
ALTER TABLE "StaffBvnVerification"
  ADD COLUMN IF NOT EXISTS "bvnHash" TEXT;
CREATE INDEX IF NOT EXISTS "StaffBvnVerification_bvnHash_idx"
  ON "StaffBvnVerification" ("bvnHash");

CREATE TABLE IF NOT EXISTS "PaystackCardAttemptGuard" (
  "cardId" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "cooldownUntil" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "SalaryDisbursement" (
  "id" TEXT PRIMARY KEY,
  "staffId" TEXT NOT NULL,
  "payrollId" TEXT,
  "bankCode" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "narration" TEXT,
  "reference" TEXT NOT NULL UNIQUE,
  "batchReference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "scheduledDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SalaryDisbursement_staffId_idx"
  ON "SalaryDisbursement" ("staffId");
CREATE INDEX IF NOT EXISTS "SalaryDisbursement_payrollId_idx"
  ON "SalaryDisbursement" ("payrollId");
CREATE INDEX IF NOT EXISTS "SalaryDisbursement_batchReference_idx"
  ON "SalaryDisbursement" ("batchReference");
CREATE INDEX IF NOT EXISTS "SalaryDisbursement_status_idx"
  ON "SalaryDisbursement" ("status");
CREATE INDEX IF NOT EXISTS "SalaryDisbursement_scheduledDate_idx"
  ON "SalaryDisbursement" ("scheduledDate");


-- Tables previously created dynamically by application startup/request helpers.
CREATE TABLE IF NOT EXISTS "CustomerAtmCard" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerAtmCard_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerAtmCard_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "CustomerAtmCard"
  ADD COLUMN IF NOT EXISTS "providerAuthorizationCode" TEXT;
CREATE INDEX IF NOT EXISTS "CustomerAtmCard_customerId_idx" ON "CustomerAtmCard"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerAtmCard_status_idx" ON "CustomerAtmCard"("status");

CREATE TABLE IF NOT EXISTS "PasskeyChallenge" (
  "challenge" TEXT NOT NULL,
  "userId" TEXT,
  "kind" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PasskeyChallenge_pkey" PRIMARY KEY ("challenge")
);
CREATE INDEX IF NOT EXISTS "PasskeyChallenge_user_kind_expiry_idx"
  ON "PasskeyChallenge"("userId", "kind", "expiresAt");

CREATE TABLE IF NOT EXISTS "PWFBRepaymentAllocation" (
  "repaymentId" TEXT NOT NULL,
  "principalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "interestPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PWFBRepaymentAllocation_pkey" PRIMARY KEY ("repaymentId")
);

-- Bring the legacy staff daily cashbook to the complete field set expected by
-- CashbookService. Each addition is idempotent and preserves existing values.
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS previous_cash_at_hand DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_deposits DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS daily_collection DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS weekly_collection DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS monthly_collection DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS monitor_registration_fees DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS risk_premium DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS passbook_sales DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS loan_application_form DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS withdrawal_from_bank DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS fund_received_head_office DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS fund_received_branch_other DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS receipt_others DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS fixed_other DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS other_income DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS daily_disbursement_count DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS daily_disbursement_amount DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS weekly_disbursement_count DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS weekly_disbursement_amount DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS monthly_disbursement_count DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS monthly_disbursement_amount DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS bank_deposit DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_withdrawal_count DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_withdrawal_amount DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_returned_d_w DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_returned_d DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_returned_w DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_returned_cash DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_returned_adjust DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS fund_transfer_head_office DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS fund_transfer_branch DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS others DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS other_after_total DOUBLE PRECISION NOT NULL DEFAULT 0;
