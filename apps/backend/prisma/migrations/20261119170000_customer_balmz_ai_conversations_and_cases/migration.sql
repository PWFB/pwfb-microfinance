CREATE TABLE IF NOT EXISTS "CustomerAiConversation" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" TEXT NOT NULL DEFAULT 'BALMZ AI customer support',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("id", "customerId")
);
CREATE INDEX IF NOT EXISTS "CustomerAiConversation_customerId_updatedAt_idx"
  ON "CustomerAiConversation" ("customerId", "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS "CustomerAiMessage" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK ("role" IN ('user', 'assistant')),
  "content" TEXT NOT NULL,
  "caseReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("conversationId", "customerId")
    REFERENCES "CustomerAiConversation" ("id", "customerId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CustomerAiMessage_conversation_createdAt_idx"
  ON "CustomerAiMessage" ("conversationId", "createdAt");

CREATE TABLE IF NOT EXISTS "CustomerAiCase" (
  "id" TEXT PRIMARY KEY,
  "reference" TEXT NOT NULL UNIQUE,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "conversationId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "complaint" TEXT NOT NULL,
  "attachmentName" TEXT,
  "attachmentMimeType" TEXT,
  "attachmentData" BYTEA,
  "attachmentSize" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'OPEN'
    CHECK ("status" IN ('OPEN', 'AI_ASSISTED', 'NEEDS_STAFF', 'RESOLVED')),
  "aiResponse" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("conversationId", "customerId")
    REFERENCES "CustomerAiConversation" ("id", "customerId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CustomerAiCase_customer_createdAt_idx"
  ON "CustomerAiCase" ("customerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "CustomerAiCase_conversation_createdAt_idx"
  ON "CustomerAiCase" ("conversationId", "createdAt" DESC);
