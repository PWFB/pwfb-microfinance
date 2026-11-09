CREATE TABLE "CustomerCallPreference" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL UNIQUE REFERENCES "Customer"("id") ON DELETE CASCADE,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "consentAt" TIMESTAMP(3),
  "consentVersion" TEXT NOT NULL DEFAULT '2026-11-09-v1',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CustomerCallPreference_enabled_idx" ON "CustomerCallPreference" ("enabled");

CREATE TABLE "CallSession" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT NOT NULL CHECK ("type" IN ('STAFF', 'CLIENT')),
  "branchId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT,
  "callerUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "callerStaffId" TEXT REFERENCES "Staff"("id") ON DELETE SET NULL,
  "recipientUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "recipientStaffId" TEXT REFERENCES "Staff"("id") ON DELETE SET NULL,
  "customerId" TEXT REFERENCES "Customer"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'RINGING' CHECK ("status" IN ('RINGING','ACCEPTED','DECLINED','MISSED','ENDED','FAILED')),
  "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallSession_participants_check" CHECK (
    ("type" = 'STAFF' AND "customerId" IS NULL)
    OR ("type" = 'CLIENT' AND "recipientStaffId" IS NULL AND "customerId" IS NOT NULL)
  ),
  CONSTRAINT "CallSession_distinct_users_check" CHECK ("callerUserId" <> "recipientUserId")
);
CREATE INDEX "CallSession_caller_created_idx" ON "CallSession" ("callerUserId", "createdAt" DESC);
CREATE INDEX "CallSession_recipient_status_idx" ON "CallSession" ("recipientUserId", "status", "createdAt" DESC);
CREATE INDEX "CallSession_branch_created_idx" ON "CallSession" ("branchId", "createdAt" DESC);
CREATE INDEX "CallSession_status_expiry_idx" ON "CallSession" ("status", "expiresAt");

CREATE TABLE "CallSignal" (
  "id" TEXT PRIMARY KEY,
  "sequence" BIGSERIAL NOT NULL UNIQUE,
  "callId" TEXT NOT NULL REFERENCES "CallSession"("id") ON DELETE CASCADE,
  "fromUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('OFFER','ANSWER','ICE')),
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CallSignal_call_sequence_idx" ON "CallSignal" ("callId", "sequence");
