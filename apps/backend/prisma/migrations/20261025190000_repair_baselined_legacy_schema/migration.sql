-- Repair legacy schema gaps caused by baseline-only migration history.
-- This migration is additive/idempotent: it does not drop tables, truncate rows, or reset balances.
-- Preserve existing records and keep all financial state in place.

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RolePermission_role_permission_key" UNIQUE ("role", "permission")
);
CREATE INDEX IF NOT EXISTS "RolePermission_role_idx" ON "RolePermission" ("role");

INSERT INTO "RolePermission" ("id","role","permission","enabled") VALUES
('rp_SUPER_ADMIN_WALLET_DEPOSIT','SUPER_ADMIN','WALLET_DEPOSIT',true),
('rp_SUPER_ADMIN_WALLET_WITHDRAWAL','SUPER_ADMIN','WALLET_WITHDRAWAL',true),
('rp_ADMIN_WALLET_DEPOSIT','ADMIN','WALLET_DEPOSIT',true),
('rp_ADMIN_WALLET_WITHDRAWAL','ADMIN','WALLET_WITHDRAWAL',true),
('rp_BRANCH_MANAGER_WALLET_DEPOSIT','BRANCH_MANAGER','WALLET_DEPOSIT',true),
('rp_BRANCH_MANAGER_WALLET_WITHDRAWAL','BRANCH_MANAGER','WALLET_WITHDRAWAL',true),
('rp_TELLER_WALLET_DEPOSIT','TELLER','WALLET_DEPOSIT',true),
('rp_TELLER_WALLET_WITHDRAWAL','TELLER','WALLET_WITHDRAWAL',true),
('rp_STAFF_WALLET_DEPOSIT','STAFF','WALLET_DEPOSIT',true),
('rp_STAFF_WALLET_WITHDRAWAL','STAFF','WALLET_WITHDRAWAL',false),
('rp_CUSTOMER_WALLET_DEPOSIT','CUSTOMER','WALLET_DEPOSIT',true),
('rp_CUSTOMER_WALLET_WITHDRAWAL','CUSTOMER','WALLET_WITHDRAWAL',true)
ON CONFLICT ("role","permission") DO NOTHING;

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "actorRole" TEXT,
  "action" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "recordId" TEXT,
  "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "statusCode" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog" ("actorId");
CREATE INDEX IF NOT EXISTS "AuditLog_actorRole_idx" ON "AuditLog" ("actorRole");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog" ("action");
CREATE INDEX IF NOT EXISTS "AuditLog_resource_idx" ON "AuditLog" ("resource");
CREATE INDEX IF NOT EXISTS "AuditLog_recordId_idx" ON "AuditLog" ("recordId");

CREATE TABLE IF NOT EXISTS "BranchClosing" (
  "id" TEXT PRIMARY KEY,
  "branchId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "closingDate" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "submittedBy" TEXT,
  "submittedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMPTZ,
  "checklist" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "BranchClosing_branch_period_date_key" UNIQUE ("branchId","periodId","closingDate")
);
CREATE INDEX IF NOT EXISTS "BranchClosing_branchId_idx" ON "BranchClosing" ("branchId");
CREATE INDEX IF NOT EXISTS "BranchClosing_periodId_idx" ON "BranchClosing" ("periodId");
CREATE INDEX IF NOT EXISTS "BranchClosing_status_idx" ON "BranchClosing" ("status");
CREATE INDEX IF NOT EXISTS "BranchClosing_closingDate_idx" ON "BranchClosing" ("closingDate");

CREATE TABLE IF NOT EXISTS staff_wallets (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL UNIQUE REFERENCES "Staff"(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES "Branch"(id),
  balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS staff_wallet_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES staff_wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  previous_balance DOUBLE PRECISION NOT NULL,
  new_balance DOUBLE PRECISION NOT NULL,
  reference TEXT,
  description TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS staff_wallet_tx_wallet_created_idx ON staff_wallet_transactions(wallet_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cashbook_daily_records (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES "FinancialPeriod"(id),
  branch_id TEXT NOT NULL REFERENCES "Branch"(id),
  staff_id TEXT,
  entry_date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  previous_cash_at_hand DOUBLE PRECISION NOT NULL DEFAULT 0,
  savings_deposits DOUBLE PRECISION NOT NULL DEFAULT 0,
  daily_collection DOUBLE PRECISION NOT NULL DEFAULT 0,
  weekly_collection DOUBLE PRECISION NOT NULL DEFAULT 0,
  monthly_collection DOUBLE PRECISION NOT NULL DEFAULT 0,
  monitor_registration_fees DOUBLE PRECISION NOT NULL DEFAULT 0,
  risk_premium DOUBLE PRECISION NOT NULL DEFAULT 0,
  passbook_sales DOUBLE PRECISION NOT NULL DEFAULT 0,
  loan_application_form DOUBLE PRECISION NOT NULL DEFAULT 0,
  fixed_other DOUBLE PRECISION NOT NULL DEFAULT 0,
  other_income DOUBLE PRECISION NOT NULL DEFAULT 0,
  daily_disbursement_count DOUBLE PRECISION NOT NULL DEFAULT 0,
  daily_disbursement_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  weekly_disbursement_count DOUBLE PRECISION NOT NULL DEFAULT 0,
  weekly_disbursement_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  monthly_disbursement_count DOUBLE PRECISION NOT NULL DEFAULT 0,
  monthly_disbursement_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  bank_deposit DOUBLE PRECISION NOT NULL DEFAULT 0,
  savings_withdrawal_count DOUBLE PRECISION NOT NULL DEFAULT 0,
  savings_withdrawal_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  savings_returned_d_w DOUBLE PRECISION NOT NULL DEFAULT 0,
  savings_returned_cash DOUBLE PRECISION NOT NULL DEFAULT 0,
  savings_returned_adjust DOUBLE PRECISION NOT NULL DEFAULT 0,
  fund_transfer_head_office DOUBLE PRECISION NOT NULL DEFAULT 0,
  fund_transfer_branch DOUBLE PRECISION NOT NULL DEFAULT 0,
  others DOUBLE PRECISION NOT NULL DEFAULT 0,
  narration TEXT,
  reference_no TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS cashbook_daily_period_branch_date_idx ON cashbook_daily_records(period_id, branch_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS cashbook_daily_staff_date_idx ON cashbook_daily_records(staff_id, created_at DESC);

-- Ensure the third (Super Admin charges) wallet exists alongside customer and staff wallets.
CREATE TABLE IF NOT EXISTS "pwfb_admin_wallet" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "pwfb_admin_wallet_transactions" (
  "id" TEXT PRIMARY KEY,
  "walletId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "previousBalance" DOUBLE PRECISION NOT NULL,
  "newBalance" DOUBLE PRECISION NOT NULL,
  "reference" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "pwfb_admin_wallet_transactions_createdAt_idx"
  ON "pwfb_admin_wallet_transactions" ("walletId","createdAt" DESC);
INSERT INTO "pwfb_admin_wallet" ("id","name")
VALUES ('SUPER_ADMIN_CHARGES','Super Admin Charges Wallet')
ON CONFLICT ("id") DO NOTHING;

CREATE OR REPLACE FUNCTION pwfb_assert_branch_open(p_branch_id TEXT, p_at TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_branch_id IS NULL OR p_branch_id = '' THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM "BranchClosing" bc
    WHERE bc."branchId" = p_branch_id
      AND bc."status" = 'CLOSED'
      AND bc."closingDate" = (p_at AT TIME ZONE 'Africa/Lagos')::date
  ) THEN
    RAISE EXCEPTION 'BRANCH_DAY_CLOSED:%:%', p_branch_id, (p_at AT TIME ZONE 'Africa/Lagos')::date
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pwfb_lock_daily_collection()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pwfb_assert_branch_open(NEW."branchId", COALESCE(NEW."collectionDate", NOW()));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pwfb_daily_collection_branch_lock ON "DailyCollection";
CREATE TRIGGER pwfb_daily_collection_branch_lock
BEFORE INSERT OR UPDATE OF "branchId", "collectionDate", amount, type, "customerId", "staffId"
ON "DailyCollection" FOR EACH ROW EXECUTE FUNCTION pwfb_lock_daily_collection();

CREATE OR REPLACE FUNCTION pwfb_lock_cashbook_entry()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pwfb_assert_branch_open(NEW."branchId", COALESCE(NEW."entryDate", NOW()));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pwfb_cashbook_entry_branch_lock ON "CashbookEntry";
CREATE TRIGGER pwfb_cashbook_entry_branch_lock
BEFORE INSERT OR UPDATE OF "branchId", "entryDate", amount, type
ON "CashbookEntry" FOR EACH ROW EXECUTE FUNCTION pwfb_lock_cashbook_entry();

CREATE OR REPLACE FUNCTION pwfb_lock_cashbook_daily_record()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pwfb_assert_branch_open(NEW.branch_id, COALESCE(NEW.entry_date, NOW()));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pwfb_cashbook_daily_record_branch_lock ON cashbook_daily_records;
CREATE TRIGGER pwfb_cashbook_daily_record_branch_lock
BEFORE INSERT OR UPDATE OF branch_id, entry_date, previous_cash_at_hand,
  savings_deposits, daily_collection, weekly_collection, monthly_collection,
  monitor_registration_fees, risk_premium, passbook_sales, loan_application_form,
  fixed_other, other_income, daily_disbursement_count, daily_disbursement_amount,
  weekly_disbursement_count, weekly_disbursement_amount, monthly_disbursement_count,
  monthly_disbursement_amount, bank_deposit, savings_withdrawal_count,
  savings_withdrawal_amount, savings_returned_d_w, savings_returned_cash,
  savings_returned_adjust, fund_transfer_head_office, fund_transfer_branch, others
ON cashbook_daily_records FOR EACH ROW EXECUTE FUNCTION pwfb_lock_cashbook_daily_record();

CREATE OR REPLACE FUNCTION pwfb_lock_savings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_branch_id TEXT;
BEGIN
  SELECT c."branchId" INTO v_branch_id FROM "Customer" c WHERE c.id = NEW."customerId";
  PERFORM pwfb_assert_branch_open(v_branch_id, COALESCE(NEW."createdAt", NOW()));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pwfb_savings_branch_lock ON "Savings";
CREATE TRIGGER pwfb_savings_branch_lock
BEFORE INSERT OR UPDATE OF "customerId", amount, "accountType", "periodId", "createdAt"
ON "Savings" FOR EACH ROW EXECUTE FUNCTION pwfb_lock_savings();

CREATE OR REPLACE FUNCTION pwfb_lock_loan()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_branch_id TEXT;
BEGIN
  SELECT c."branchId" INTO v_branch_id FROM "Customer" c WHERE c.id = NEW."customerId";
  PERFORM pwfb_assert_branch_open(v_branch_id, NOW());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pwfb_loan_branch_lock ON "Loan";
CREATE TRIGGER pwfb_loan_branch_lock
BEFORE INSERT OR UPDATE OF "customerId", amount, status, "disbursementAmount",
  "disbursementAccountNumber", "disbursementAccountName", "disbursementBankCode",
  "disbursementBankName", "disbursementUsesAlternativeAccount", "periodId"
ON "Loan" FOR EACH ROW EXECUTE FUNCTION pwfb_lock_loan();

CREATE OR REPLACE FUNCTION pwfb_lock_repayment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_branch_id TEXT;
BEGIN
  SELECT c."branchId" INTO v_branch_id
  FROM "Loan" l JOIN "Customer" c ON c.id = l."customerId"
  WHERE l.id = NEW."loanId";
  PERFORM pwfb_assert_branch_open(v_branch_id, COALESCE(NEW."paymentDate", NOW()));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pwfb_repayment_branch_lock ON "Repayment";
CREATE TRIGGER pwfb_repayment_branch_lock
BEFORE INSERT OR UPDATE OF "loanId", amount, "paymentDate", method, "periodId"
ON "Repayment" FOR EACH ROW EXECUTE FUNCTION pwfb_lock_repayment();

CREATE OR REPLACE FUNCTION pwfb_lock_transaction()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_branch_id TEXT;
BEGIN
  SELECT c."branchId" INTO v_branch_id FROM "Customer" c WHERE c.id = NEW."customerId";
  PERFORM pwfb_assert_branch_open(v_branch_id, COALESCE(NEW."createdAt", NOW()));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pwfb_transaction_branch_lock ON "Transaction";
CREATE TRIGGER pwfb_transaction_branch_lock
BEFORE INSERT OR UPDATE OF "customerId", type, amount, "periodId", "createdAt"
ON "Transaction" FOR EACH ROW EXECUTE FUNCTION pwfb_lock_transaction();

CREATE OR REPLACE FUNCTION pwfb_lock_staff_wallet_transaction()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_branch_id TEXT;
BEGIN
  SELECT sw.branch_id INTO v_branch_id FROM staff_wallets sw WHERE sw.id = NEW.wallet_id;
  PERFORM pwfb_assert_branch_open(v_branch_id, COALESCE(NEW.created_at, NOW()));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pwfb_staff_wallet_transaction_branch_lock ON staff_wallet_transactions;
CREATE TRIGGER pwfb_staff_wallet_transaction_branch_lock
BEFORE INSERT OR UPDATE OF wallet_id, type, amount, previous_balance, new_balance, created_at
ON staff_wallet_transactions FOR EACH ROW EXECUTE FUNCTION pwfb_lock_staff_wallet_transaction();

CREATE OR REPLACE FUNCTION pwfb_lock_payroll()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."branchId" IS NOT NULL AND NEW."paymentDate" IS NOT NULL THEN
    PERFORM pwfb_assert_branch_open(NEW."branchId", NEW."paymentDate");
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pwfb_payroll_branch_lock ON "Payroll";
CREATE TRIGGER pwfb_payroll_branch_lock
BEFORE INSERT OR UPDATE OF "branchId", status, "totalNet", "paymentDate"
ON "Payroll" FOR EACH ROW EXECUTE FUNCTION pwfb_lock_payroll();
