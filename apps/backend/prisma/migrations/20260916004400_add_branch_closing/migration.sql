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
CREATE INDEX IF NOT EXISTS "BranchClosing_branchId_idx" ON "BranchClosing"("branchId");
CREATE INDEX IF NOT EXISTS "BranchClosing_periodId_idx" ON "BranchClosing"("periodId");
CREATE INDEX IF NOT EXISTS "BranchClosing_status_idx" ON "BranchClosing"("status");
CREATE INDEX IF NOT EXISTS "BranchClosing_closingDate_idx" ON "BranchClosing"("closingDate");
