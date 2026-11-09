ALTER TABLE "CustomerVirtualAccount"
  ADD COLUMN IF NOT EXISTS "lastRequeryAt" TIMESTAMP(3);
ALTER TABLE "BranchVirtualAccount"
  ADD COLUMN IF NOT EXISTS "lastRequeryAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CustomerVirtualAccount_provider_requery_idx"
  ON "CustomerVirtualAccount" ("provider", "status", "lastRequeryAt");
CREATE INDEX IF NOT EXISTS "BranchVirtualAccount_provider_requery_idx"
  ON "BranchVirtualAccount" ("provider", "status", "lastRequeryAt");
