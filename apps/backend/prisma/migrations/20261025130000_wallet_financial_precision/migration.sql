-- Wallet ledger precision migration.
-- This file is intentionally kept in a draft PR until the exact deployed
-- database target, rounding-residue audit, and verified backup are approved.
-- The USING expressions make the two-decimal half-up policy explicit.
ALTER TABLE "CustomerWallet"
  ALTER COLUMN "balance" TYPE NUMERIC(20,2)
    USING ROUND("balance"::numeric, 2),
  ALTER COLUMN "balance" SET DEFAULT 0.00;

ALTER TABLE "WalletTransaction"
  ALTER COLUMN "amount" TYPE NUMERIC(20,2)
    USING ROUND("amount"::numeric, 2),
  ALTER COLUMN "previousBalance" TYPE NUMERIC(20,2)
    USING ROUND("previousBalance"::numeric, 2),
  ALTER COLUMN "newBalance" TYPE NUMERIC(20,2)
    USING ROUND("newBalance"::numeric, 2);
