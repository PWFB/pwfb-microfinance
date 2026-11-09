CREATE TABLE "BranchMessageConversation" (
  "id" TEXT PRIMARY KEY,
  "branchId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL CHECK ("type" IN ('ROLE', 'GROUP')),
  "roleTarget" TEXT,
  "title" TEXT,
  "createdByUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdByStaffId" TEXT REFERENCES "Staff"("id") ON DELETE SET NULL,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BranchMessageConversation_kind_check" CHECK (
    ("type" = 'ROLE' AND "roleTarget" IS NOT NULL AND "title" IS NULL)
    OR ("type" = 'GROUP' AND "roleTarget" IS NULL AND "title" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "BranchMessageConversation_branch_role_unique"
  ON "BranchMessageConversation" ("branchId", "roleTarget")
  WHERE "type" = 'ROLE';
CREATE INDEX "BranchMessageConversation_branch_last_idx"
  ON "BranchMessageConversation" ("branchId", "lastMessageAt" DESC);

CREATE TABLE "BranchMessageMember" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL REFERENCES "BranchMessageConversation"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "staffId" TEXT REFERENCES "Staff"("id") ON DELETE SET NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BranchMessageMember_conversation_user_unique" UNIQUE ("conversationId", "userId")
);
CREATE INDEX "BranchMessageMember_user_idx" ON "BranchMessageMember" ("userId", "conversationId");

CREATE TABLE "BranchMessage" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL REFERENCES "BranchMessageConversation"("id") ON DELETE CASCADE,
  "senderUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "senderStaffId" TEXT REFERENCES "Staff"("id") ON DELETE SET NULL,
  "body" TEXT NOT NULL CHECK (length("body") BETWEEN 1 AND 5000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BranchMessage_conversation_created_idx"
  ON "BranchMessage" ("conversationId", "createdAt");
CREATE INDEX "BranchMessage_sender_created_idx"
  ON "BranchMessage" ("senderUserId", "createdAt");

CREATE TABLE "BranchMessageReadState" (
  "conversationId" TEXT NOT NULL REFERENCES "BranchMessageConversation"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("conversationId", "userId")
);
CREATE INDEX "BranchMessageReadState_user_idx"
  ON "BranchMessageReadState" ("userId", "lastReadAt");
