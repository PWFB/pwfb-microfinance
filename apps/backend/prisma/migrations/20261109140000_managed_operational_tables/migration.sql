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
