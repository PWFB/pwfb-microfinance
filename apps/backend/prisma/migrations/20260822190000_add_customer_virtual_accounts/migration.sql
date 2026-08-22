CREATE TABLE "CustomerVirtualAccount" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "accountNumber" TEXT,
  "accountName" TEXT,
  "bankName" TEXT,
  "bankCode" TEXT,
  "provider" TEXT NOT NULL,
  "providerReference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerVirtualAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerVirtualAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerVirtualAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CustomerVirtualAccount_accountNumber_key" ON "CustomerVirtualAccount"("accountNumber");
CREATE UNIQUE INDEX "CustomerVirtualAccount_customerId_key" ON "CustomerVirtualAccount"("customerId");
CREATE INDEX "CustomerVirtualAccount_branchId_idx" ON "CustomerVirtualAccount"("branchId");
CREATE INDEX "CustomerVirtualAccount_status_idx" ON "CustomerVirtualAccount"("status");
