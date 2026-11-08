ALTER TABLE "Repayment" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "Repayment" ADD COLUMN IF NOT EXISTS "staffId" TEXT;
ALTER TABLE "Repayment" ADD COLUMN IF NOT EXISTS "reference" TEXT;

CREATE INDEX IF NOT EXISTS "Repayment_branchId_idx" ON "Repayment" ("branchId");
CREATE INDEX IF NOT EXISTS "Repayment_staffId_idx" ON "Repayment" ("staffId");
CREATE UNIQUE INDEX IF NOT EXISTS "Repayment_reference_key" ON "Repayment" ("reference");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Repayment_branchId_fkey') THEN
    ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Repayment_staffId_fkey') THEN
    ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_staffId_fkey"
      FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
