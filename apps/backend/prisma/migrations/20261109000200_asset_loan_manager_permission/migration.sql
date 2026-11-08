-- This migration follows the enum migration so PostgreSQL has committed
-- ASSET_LOAN_MANAGER before it is used as a RolePermission.role value.
INSERT INTO "RolePermission" ("id","role","permission","enabled","updatedAt")
VALUES ('rp_ASSET_LOAN_MANAGER_ASSET_LOAN_REVIEW','ASSET_LOAN_MANAGER','ASSET_LOAN_REVIEW',TRUE,CURRENT_TIMESTAMP)
ON CONFLICT ("role","permission") DO UPDATE
SET "enabled" = EXCLUDED."enabled", "updatedAt" = CURRENT_TIMESTAMP;

-- Existing branch collections roles receive the dedicated bulk cash repayment permission.
INSERT INTO "RolePermission" ("id","role","permission","enabled","updatedAt") VALUES
  ('rp_TELLER_BULK_REPAYMENT_CREATE','TELLER','BULK_REPAYMENT_CREATE',TRUE,CURRENT_TIMESTAMP),
  ('rp_CREDIT_OFFICER_BULK_REPAYMENT_CREATE','CREDIT_OFFICER','BULK_REPAYMENT_CREATE',TRUE,CURRENT_TIMESTAMP)
ON CONFLICT ("role","permission") DO UPDATE
SET "enabled"=EXCLUDED."enabled","updatedAt"=CURRENT_TIMESTAMP;
