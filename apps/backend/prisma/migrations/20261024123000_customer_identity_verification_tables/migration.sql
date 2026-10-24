CREATE TABLE IF NOT EXISTS customer_identity_verifications (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE REFERENCES "Customer"("id") ON DELETE CASCADE,
  bvn TEXT,
  bvn_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED',
  bvn_verified_at TIMESTAMP,
  bvn_overridden_at TIMESTAMP,
  bvn_override_by_user_id TEXT,
  bvn_override_by_email TEXT,
  bvn_override_reason TEXT,
  nin TEXT,
  nin_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED',
  nin_verified_at TIMESTAMP,
  nin_overridden_at TIMESTAMP,
  nin_override_by_user_id TEXT,
  nin_override_by_email TEXT,
  nin_override_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_identity_override_audits (
  id TEXT PRIMARY KEY,
  verification_id TEXT NOT NULL REFERENCES customer_identity_verifications(id) ON DELETE CASCADE,
  identity_type TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  admin_user_id TEXT NOT NULL,
  admin_email TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_identity_verifications_bvn_status_idx
  ON customer_identity_verifications (bvn_status);
CREATE INDEX IF NOT EXISTS customer_identity_verifications_nin_status_idx
  ON customer_identity_verifications (nin_status);
CREATE INDEX IF NOT EXISTS customer_identity_override_audits_verification_id_idx
  ON customer_identity_override_audits (verification_id);
