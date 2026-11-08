-- Branch end-of-day lock.
-- Once a branch is finalized (BranchClosing.status = CLOSED), financial mutations
-- for that branch and closing date are rejected at the database boundary.

CREATE OR REPLACE FUNCTION pwfb_assert_branch_open(p_branch_id TEXT, p_at TIMESTAMPTZ)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_branch_id IS NULL OR p_branch_id = '' THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "BranchClosing" bc
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
ON "DailyCollection"
FOR EACH ROW EXECUTE FUNCTION pwfb_lock_daily_collection();

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
ON "CashbookEntry"
FOR EACH ROW EXECUTE FUNCTION pwfb_lock_cashbook_entry();

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
ON cashbook_daily_records
FOR EACH ROW EXECUTE FUNCTION pwfb_lock_cashbook_daily_record();

CREATE OR REPLACE FUNCTION pwfb_lock_savings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_branch_id TEXT;
BEGIN
  SELECT c."branchId" INTO v_branch_id FROM "Customer" c WHERE c.id = NEW."customerId";
  PERFORM pwfb_assert_branch_open(v_branch_id, COALESCE(NEW."createdAt", NOW()));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pwfb_savings_branch_lock ON "Savings";
CREATE TRIGGER pwfb_savings_branch_lock
BEFORE INSERT OR UPDATE OF "customerId", amount, "accountType", "periodId", "createdAt"
ON "Savings"
FOR EACH ROW EXECUTE FUNCTION pwfb_lock_savings();

CREATE OR REPLACE FUNCTION pwfb_lock_loan()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_branch_id TEXT;
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
ON "Loan"
FOR EACH ROW EXECUTE FUNCTION pwfb_lock_loan();

CREATE OR REPLACE FUNCTION pwfb_lock_repayment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_branch_id TEXT;
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
ON "Repayment"
FOR EACH ROW EXECUTE FUNCTION pwfb_lock_repayment();

CREATE OR REPLACE FUNCTION pwfb_lock_transaction()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_branch_id TEXT;
BEGIN
  SELECT c."branchId" INTO v_branch_id FROM "Customer" c WHERE c.id = NEW."customerId";
  PERFORM pwfb_assert_branch_open(v_branch_id, COALESCE(NEW."createdAt", NOW()));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pwfb_transaction_branch_lock ON "Transaction";
CREATE TRIGGER pwfb_transaction_branch_lock
BEFORE INSERT OR UPDATE OF "customerId", type, amount, "periodId", "createdAt"
ON "Transaction"
FOR EACH ROW EXECUTE FUNCTION pwfb_lock_transaction();

CREATE OR REPLACE FUNCTION pwfb_lock_staff_wallet_transaction()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_branch_id TEXT;
BEGIN
  SELECT sw.branch_id INTO v_branch_id FROM staff_wallets sw WHERE sw.id = NEW.wallet_id;
  PERFORM pwfb_assert_branch_open(v_branch_id, COALESCE(NEW.created_at, NOW()));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pwfb_staff_wallet_transaction_branch_lock ON staff_wallet_transactions;
CREATE TRIGGER pwfb_staff_wallet_transaction_branch_lock
BEFORE INSERT OR UPDATE OF wallet_id, type, amount, previous_balance, new_balance, created_at
ON staff_wallet_transactions
FOR EACH ROW EXECUTE FUNCTION pwfb_lock_staff_wallet_transaction();

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
ON "Payroll"
FOR EACH ROW EXECUTE FUNCTION pwfb_lock_payroll();
