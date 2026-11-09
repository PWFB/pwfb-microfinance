CREATE TYPE "WorkItemStatus" AS ENUM ('TODO','IN_PROGRESS','BLOCKED','UNVERIFIED','COMPLETED');
CREATE TYPE "WorkItemPriority" AS ENUM ('LOW','NORMAL','HIGH','CRITICAL');

CREATE TABLE "WorkItem" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "sessionKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "status" "WorkItemStatus" NOT NULL DEFAULT 'TODO',
  "priority" "WorkItemPriority" NOT NULL DEFAULT 'NORMAL',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "environment" TEXT,
  "branch" TEXT,
  "commitSha" TEXT,
  "pullRequestUrl" TEXT,
  "deploymentUrl" TEXT,
  "evidenceUrl" TEXT,
  "verificationSummary" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "assignedToUserId" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WorkItem_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkItem_reference_key" ON "WorkItem"("reference");
CREATE INDEX "WorkItem_status_updatedAt_idx" ON "WorkItem"("status","updatedAt");
CREATE INDEX "WorkItem_sessionKey_status_idx" ON "WorkItem"("sessionKey","status");
CREATE INDEX "WorkItem_category_status_idx" ON "WorkItem"("category","status");
CREATE INDEX "WorkItem_priority_status_idx" ON "WorkItem"("priority","status");
CREATE INDEX "WorkItem_createdAt_idx" ON "WorkItem"("createdAt");

CREATE TABLE "WorkItemEvent" (
  "id" TEXT NOT NULL,
  "workItemId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStatus" "WorkItemStatus",
  "toStatus" "WorkItemStatus",
  "note" TEXT,
  "changes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkItemEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkItemEvent_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WorkItemEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WorkItemEvent_workItemId_createdAt_idx" ON "WorkItemEvent"("workItemId","createdAt");
CREATE INDEX "WorkItemEvent_actorUserId_createdAt_idx" ON "WorkItemEvent"("actorUserId","createdAt");


-- Initial operational register snapshot. This runs only when this migration is
-- explicitly applied to the selected environment. If no Super Admin/Admin user
-- exists yet, the seed is skipped; no synthetic actor is created.
WITH actor AS (
  SELECT "id"
  FROM "User"
  WHERE "role" IN ('SUPER_ADMIN', 'ADMIN')
  ORDER BY CASE WHEN "role" = 'SUPER_ADMIN' THEN 0 ELSE 1 END, "createdAt" ASC
  LIMIT 1
),
seed_rows (
  "id", "reference", "sessionKey", "title", "description", "category",
  "status", "priority", "tags", "environment", "branch", "commitSha",
  "pullRequestUrl", "deploymentUrl", "verificationSummary", "completedAt"
) AS (
  VALUES
  (
    'seed-work-pr-107',
    'PWFB-WORK-20261109-0000000000000107',
    'PWFB-SESSION-20261109',
    'Merge and deploy PWFB staging release PR #107',
    'Completed release milestone only: PR #107 was merged to staging and both Render staging frontend and backend deployments reported live on merge commit 84b644941fa4a38dbea04a97a01d89e80696c7a8. Database-backed features introduced by the PR remain separately unverified because the existing staging Postgres is suspended.',
    'DEPLOYMENT',
    'COMPLETED'::"WorkItemStatus",
    'NORMAL'::"WorkItemPriority",
    ARRAY['pr-107','render','staging','release']::TEXT[],
    'STAGING',
    'staging',
    '84b644941fa4a38dbea04a97a01d89e80696c7a8',
    'https://github.com/PWFB/pwfb-microfinance/pull/107',
    'https://pwfb-microfinance-staging.onrender.com',
    'GitHub Actions run 42607466566 passed Prisma validation, backend build, backend tests, frontend tests, frontend build and backend Docker build on PR head 9aae750e8ced4cf81e8eae461b7b48a2c1f966c3. Render staging frontend and backend deployments dep-dboqth5g1s2s738rsa30 and dep-dboqth5g1s2s738rs9ig both reported live on merge commit 84b6449. This completion covers the merge and Render deployment milestone only; it does not certify database migrations or database-backed runtime flows.',
    CURRENT_TIMESTAMP
  ),
  (
    'seed-work-pr-108',
    'PWFB-WORK-20261109-0000000000000108',
    'PWFB-SESSION-20261109',
    'Implement searchable backend work register and PWFB cleanup',
    'PR #108 adds a separate searchable WorkItem/WorkItemEvent register, migration-managed operational tables, removal of runtime schema DDL, and access-scope/reporting corrections. Keep this item unverified until fresh CI is green and database-backed smoke tests are completed on the explicitly approved Render staging database.',
    'BACKEND',
    'UNVERIFIED'::"WorkItemStatus",
    'HIGH'::"WorkItemPriority",
    ARRAY['pr-108','backend','cleanup','work-log','access-scope']::TEXT[],
    'STAGING',
    'feat/pwfb-searchable-work-register',
    NULL,
    'https://github.com/PWFB/pwfb-microfinance/pull/108',
    NULL,
    NULL,
    NULL
  ),
  (
    'seed-work-staging-db',
    'PWFB-WORK-20261109-0000000000000109',
    'PWFB-SESSION-20261109',
    'Restore and validate the existing Render staging PostgreSQL database',
    'BLOCKED: pwfb-staging-db (dpg-db2cgevlk1mc73au1fmg-a) was reported suspended by billing and expired on 2026-11-05. Restore the same existing database and approve a migration/backup plan before running the pending migration chain. Do not substitute Neon; no Neon staging check or write is authorized.',
    'DATABASE',
    'BLOCKED'::"WorkItemStatus",
    'CRITICAL'::"WorkItemPriority",
    ARRAY['database','render','staging','billing','blocked']::TEXT[],
    'STAGING',
    'staging',
    NULL,
    NULL,
    'https://dashboard.render.com/d/dpg-db2cgevlk1mc73au1fmg-a',
    NULL,
    NULL
  )
),
created AS (
  INSERT INTO "WorkItem" (
    "id", "reference", "sessionKey", "title", "description", "category",
    "status", "priority", "tags", "environment", "branch", "commitSha",
    "pullRequestUrl", "deploymentUrl", "verificationSummary", "createdByUserId",
    "completedAt", "createdAt", "updatedAt"
  )
  SELECT
    seed."id", seed."reference", seed."sessionKey", seed."title", seed."description", seed."category",
    seed."status", seed."priority", seed."tags", seed."environment", seed."branch", seed."commitSha",
    seed."pullRequestUrl", seed."deploymentUrl", seed."verificationSummary", actor."id",
    seed."completedAt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM seed_rows seed CROSS JOIN actor
  ON CONFLICT ("reference") DO NOTHING
  RETURNING "id", "reference", "status", "createdByUserId"
)
INSERT INTO "WorkItemEvent" (
  "id", "workItemId", "actorUserId", "eventType", "fromStatus", "toStatus", "note", "changes", "createdAt"
)
SELECT
  'seed-event-' || "reference",
  "id",
  "createdByUserId",
  'SEEDED',
  NULL,
  "status",
  'Initial work register snapshot inserted by the approved schema migration.',
  jsonb_build_object('reference', "reference", 'source', 'migration-seed'),
  CURRENT_TIMESTAMP
FROM created;
