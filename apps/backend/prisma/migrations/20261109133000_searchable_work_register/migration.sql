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
