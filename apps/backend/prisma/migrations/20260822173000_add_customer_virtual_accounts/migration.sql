CREATE TYPE "VirtualAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED', 'INACTIVE');

CREATE TABLE "CustomerVirtualAccount" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "institutionId" TEXT,
  "branchId" TEXT,
  "accountNumber" TEXT,
  "accountName" TEXT,
  "provider" TEXT,
  "providerReference" TEXT,
  "status" "VirtualAccountStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerVirtualAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerVirtualAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerVirtualAccount_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "BankInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CustomerVirtualAccount_accountNumber_key" ON "CustomerVirtualAccount"("accountNumber");
CREATE UNIQUE INDEX "CustomerVirtualAccount_providerReference_key" ON "CustomerVirtualAccount"("providerReference");
CREATE INDEX "CustomerVirtualAccount_customerId_idx" ON "CustomerVirtualAccount"("customerId");
CREATE INDEX "CustomerVirtualAccount_institutionId_idx" ON "CustomerVirtualAccount"("institutionId");
CREATE INDEX "CustomerVirtualAccount_branchId_idx" ON "CustomerVirtualAccount"("branchId");
CREATE INDEX "CustomerVirtualAccount_status_idx" ON "CustomerVirtualAccount"("status");
