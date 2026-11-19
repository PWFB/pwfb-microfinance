ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "reference" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_reference_key"
ON "Transaction"("reference");
