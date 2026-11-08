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
CREATE INDEX IF NOT EXISTS cashbook_daily_staff_date_idx ON cashbook_daily_records(staff_id, entry_date DESC);
