ALTER TABLE "CustomerVirtualAccount"
  ADD COLUMN IF NOT EXISTS "providerCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerBankName" TEXT,
  ADD COLUMN IF NOT EXISTS "consentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CustomerVirtualAccount_providerCustomerId_idx" ON "CustomerVirtualAccount"("providerCustomerId");

CREATE TABLE IF NOT EXISTS "StaffVirtualAccount" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "institutionId" TEXT,
  "accountNumber" TEXT,
  "accountName" TEXT,
  "bankName" TEXT,
  "provider" TEXT,
  "providerCustomerCode" TEXT,
  "providerAccountId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffVirtualAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StaffVirtualAccount_staffId_key" ON "StaffVirtualAccount"("staffId");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffVirtualAccount_accountNumber_key" ON "StaffVirtualAccount"("accountNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffVirtualAccount_providerCustomerCode_key" ON "StaffVirtualAccount"("providerCustomerCode");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffVirtualAccount_providerAccountId_key" ON "StaffVirtualAccount"("providerAccountId");
CREATE INDEX IF NOT EXISTS "StaffVirtualAccount_institutionId_idx" ON "StaffVirtualAccount"("institutionId");
CREATE INDEX IF NOT EXISTS "StaffVirtualAccount_status_idx" ON "StaffVirtualAccount"("status");

ALTER TABLE "StaffVirtualAccount"
  ADD CONSTRAINT "StaffVirtualAccount_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffVirtualAccount"
  ADD CONSTRAINT "StaffVirtualAccount_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "BankInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
