CREATE TABLE IF NOT EXISTS head_office_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS head_office_account_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES head_office_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  previous_balance DOUBLE PRECISION NOT NULL,
  new_balance DOUBLE PRECISION NOT NULL,
  reference TEXT,
  description TEXT,
  payroll_id TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS head_office_account_tx_created_idx ON head_office_account_transactions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS head_office_account_tx_payroll_idx ON head_office_account_transactions(payroll_id);

INSERT INTO head_office_accounts (id, name, balance, currency)
VALUES ('HEAD_OFFICE', 'Head Office Account', 0, 'NGN')
ON CONFLICT (id) DO NOTHING;
