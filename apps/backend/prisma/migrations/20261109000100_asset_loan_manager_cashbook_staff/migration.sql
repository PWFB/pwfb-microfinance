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

-- Teller is a deposit/cashbook operator, not a withdrawal or transfer approver.
UPDATE "RolePermission"
SET "enabled" = FALSE, "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" = 'TELLER'
  AND "permission" IN ('WALLET_WITHDRAWAL','BANK_TRANSFER','SAVINGS_WITHDRAW','LOAN_DISBURSE');

-- Explicitly persist the Teller's approved customer, loan-intake and cashbook duties.
INSERT INTO "RolePermission" ("id","role","permission","enabled","updatedAt") VALUES
  ('rp_TELLER_WALLET_DEPOSIT','TELLER','WALLET_DEPOSIT',TRUE,CURRENT_TIMESTAMP),
  ('rp_TELLER_CUSTOMER_CREATE','TELLER','CUSTOMER_CREATE',TRUE,CURRENT_TIMESTAMP),
  ('rp_TELLER_SAVINGS_CREATE','TELLER','SAVINGS_CREATE',TRUE,CURRENT_TIMESTAMP),
  ('rp_TELLER_LOAN_CREATE','TELLER','LOAN_CREATE',TRUE,CURRENT_TIMESTAMP),
  ('rp_TELLER_COLLECTION_CREATE','TELLER','COLLECTION_CREATE',TRUE,CURRENT_TIMESTAMP),
  ('rp_TELLER_COLLECTION_SETTLE','TELLER','COLLECTION_SETTLE',TRUE,CURRENT_TIMESTAMP),
  ('rp_TELLER_CASHBOOK_CREATE','TELLER','CASHBOOK_CREATE',TRUE,CURRENT_TIMESTAMP),
  ('rp_TELLER_CASHBOOK_DAILY_CREATE','TELLER','CASHBOOK_DAILY_CREATE',TRUE,CURRENT_TIMESTAMP),
  ('rp_CREDIT_OFFICER_CASHBOOK_DAILY_CREATE','CREDIT_OFFICER','CASHBOOK_DAILY_CREATE',TRUE,CURRENT_TIMESTAMP),
  ('rp_ASSET_LOAN_MANAGER_ASSET_LOAN_REVIEW','ASSET_LOAN_MANAGER','ASSET_LOAN_REVIEW',TRUE,CURRENT_TIMESTAMP)
ON CONFLICT ("role","permission") DO UPDATE
SET "enabled" = EXCLUDED."enabled", "updatedAt" = CURRENT_TIMESTAMP;

-- Existing Individual Loan applications awaiting disbursement also need a second review.
UPDATE "PWFBLoanMeta" m
SET "assetReviewStatus" = 'PENDING_ASSET_REVIEW', "updatedAt" = CURRENT_TIMESTAMP
FROM "Loan" l
WHERE l."id" = m."loanId"
  AND m."loanType" = 'Individual Loan'
  AND l."status" NOT IN ('DISBURSED','DISBURSEMENT_FAILED')
  AND m."assetReviewStatus" = 'NOT_REQUIRED';
