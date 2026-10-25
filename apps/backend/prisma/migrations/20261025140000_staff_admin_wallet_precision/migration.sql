-- Convert raw-SQL staff and Super Admin wallet tables to fixed precision.
-- This draft migration must not be deployed until the exact Neon DATABASE_URL
-- target, data rounding audit, and a restorable backup are verified.
CREATE TABLE IF NOT EXISTS staff_wallets (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL UNIQUE REFERENCES "Staff"(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES "Branch"(id),
  balance NUMERIC(20,2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'NGN',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS staff_wallet_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES staff_wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(20,2) NOT NULL,
  previous_balance NUMERIC(20,2) NOT NULL,
  new_balance NUMERIC(20,2) NOT NULL,
  reference TEXT,
  description TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS staff_wallet_tx_wallet_created_idx
  ON staff_wallet_transactions(wallet_id, created_at DESC);

ALTER TABLE staff_wallets
  ALTER COLUMN balance TYPE NUMERIC(20,2) USING ROUND(balance::numeric, 2),
  ALTER COLUMN balance SET DEFAULT 0.00;
ALTER TABLE staff_wallet_transactions
  ALTER COLUMN amount TYPE NUMERIC(20,2) USING ROUND(amount::numeric, 2),
  ALTER COLUMN previous_balance TYPE NUMERIC(20,2) USING ROUND(previous_balance::numeric, 2),
  ALTER COLUMN new_balance TYPE NUMERIC(20,2) USING ROUND(new_balance::numeric, 2);

CREATE TABLE IF NOT EXISTS "pwfb_admin_wallet" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "balance" NUMERIC(20,2) NOT NULL DEFAULT 0.00,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "pwfb_admin_wallet_transactions" (
  "id" TEXT PRIMARY KEY,
  "walletId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" NUMERIC(20,2) NOT NULL,
  "previousBalance" NUMERIC(20,2) NOT NULL,
  "newBalance" NUMERIC(20,2) NOT NULL,
  "reference" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "pwfb_admin_wallet"
  ALTER COLUMN "balance" TYPE NUMERIC(20,2) USING ROUND("balance"::numeric, 2),
  ALTER COLUMN "balance" SET DEFAULT 0.00;
ALTER TABLE "pwfb_admin_wallet_transactions"
  ALTER COLUMN "amount" TYPE NUMERIC(20,2) USING ROUND("amount"::numeric, 2),
  ALTER COLUMN "previousBalance" TYPE NUMERIC(20,2) USING ROUND("previousBalance"::numeric, 2),
  ALTER COLUMN "newBalance" TYPE NUMERIC(20,2) USING ROUND("newBalance"::numeric, 2);

INSERT INTO "pwfb_admin_wallet" ("id","name")
VALUES ('SUPER_ADMIN_CHARGES','Super Admin Charges Wallet')
ON CONFLICT ("id") DO NOTHING;
