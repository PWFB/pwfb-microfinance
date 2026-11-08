-- Persist external payout lifecycle and provider reconciliation metadata.
ALTER TABLE "WalletTransaction"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "providerReference" TEXT,
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "processedAt" TIMESTAMP(3),
  ADD COLUMN "reversedAt" TIMESTAMP(3);

-- PostgreSQL permits multiple NULLs in a normal UNIQUE index, so providerReference
-- remains optional while real provider references are globally idempotent.
CREATE UNIQUE INDEX "WalletTransaction_providerReference_key"
  ON "WalletTransaction"("providerReference");

CREATE INDEX "WalletTransaction_status_idx"
  ON "WalletTransaction"("status");

CREATE INDEX "WalletTransaction_providerReference_idx"
  ON "WalletTransaction"("providerReference");
