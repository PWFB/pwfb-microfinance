-- Add a dedicated Asset Loan Manager role without changing existing users.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ASSET_LOAN_MANAGER';

-- Preserve staff attribution on ordinary cashbook entries as well as daily rows.
ALTER TABLE "CashbookEntry" ADD COLUMN IF NOT EXISTS "staffId" TEXT;
CREATE INDEX IF NOT EXISTS "CashbookEntry_staffId_idx" ON "CashbookEntry" ("staffId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CashbookEntry_staffId_fkey'
  ) THEN
    ALTER TABLE "CashbookEntry"
      ADD CONSTRAINT "CashbookEntry_staffId_fkey"
      FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
