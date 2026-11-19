BEGIN;

CREATE TABLE IF NOT EXISTS "CustomerAiCase" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerAiCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerAiCase_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerAiCase_subject_check" CHECK (char_length("subject") BETWEEN 1 AND 200)
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAiCase_reference_key"
  ON "CustomerAiCase"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAiCase_id_customerId_key"
  ON "CustomerAiCase"("id", "customerId");
CREATE INDEX IF NOT EXISTS "CustomerAiCase_customerId_updatedAt_idx"
  ON "CustomerAiCase"("customerId", "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS "CustomerAiCaseMessage" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerAiCaseMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerAiCaseMessage_case_owner_fkey"
    FOREIGN KEY ("caseId", "customerId")
    REFERENCES "CustomerAiCase"("id", "customerId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerAiCaseMessage_role_check" CHECK ("role" IN ('user', 'assistant')),
  CONSTRAINT "CustomerAiCaseMessage_content_check" CHECK (char_length("content") BETWEEN 1 AND 20000)
);

CREATE INDEX IF NOT EXISTS "CustomerAiCaseMessage_caseId_createdAt_idx"
  ON "CustomerAiCaseMessage"("caseId", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerAiCaseMessage_customerId_createdAt_idx"
  ON "CustomerAiCaseMessage"("customerId", "createdAt");

CREATE TABLE IF NOT EXISTS "CustomerAiCaseAttachment" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "contentBytes" BYTEA NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerAiCaseAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerAiCaseAttachment_case_owner_fkey"
    FOREIGN KEY ("caseId", "customerId")
    REFERENCES "CustomerAiCase"("id", "customerId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerAiCaseAttachment_size_check" CHECK ("size" BETWEEN 1 AND 4194304),
  CONSTRAINT "CustomerAiCaseAttachment_mime_check"
    CHECK ("mimeType" IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'))
);

CREATE INDEX IF NOT EXISTS "CustomerAiCaseAttachment_caseId_createdAt_idx"
  ON "CustomerAiCaseAttachment"("caseId", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerAiCaseAttachment_customerId_createdAt_idx"
  ON "CustomerAiCaseAttachment"("customerId", "createdAt");

COMMIT;
