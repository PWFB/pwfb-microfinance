-- Add a stable, 11-digit public login identifier without changing internal CUID primary keys.
CREATE SEQUENCE IF NOT EXISTS "User_publicUserId_seq"
  AS BIGINT
  START WITH 10000000000
  INCREMENT BY 1
  MINVALUE 10000000000
  MAXVALUE 99999999999
  NO CYCLE;

ALTER TABLE "User"
  ADD COLUMN "publicUserId" TEXT NOT NULL
  DEFAULT nextval('"User_publicUserId_seq"'::regclass)::text;

ALTER SEQUENCE "User_publicUserId_seq" OWNED BY "User"."publicUserId";
CREATE UNIQUE INDEX "User_publicUserId_key" ON "User"("publicUserId");

-- Legacy ledger transactions keep their internal IDs; new rows receive a readable reference.
ALTER TABLE "Transaction" ADD COLUMN "reference" TEXT;
CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");

-- Store uploaded receipt evidence and the verification result with a permanent reference.
CREATE TABLE "ReceiptVerification" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "file" BYTEA NOT NULL,
  "status" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "extracted" JSONB NOT NULL,
  "databaseMatch" JSONB NOT NULL,
  "reasons" JSONB NOT NULL,
  "uploadedByUserId" TEXT NOT NULL,
  "transactionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReceiptVerification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReceiptVerification_uploadedByUserId_fkey"
    FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReceiptVerification_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReceiptVerification_reference_key" ON "ReceiptVerification"("reference");
CREATE INDEX "ReceiptVerification_uploadedByUserId_idx" ON "ReceiptVerification"("uploadedByUserId");
CREATE INDEX "ReceiptVerification_transactionId_idx" ON "ReceiptVerification"("transactionId");
CREATE INDEX "ReceiptVerification_createdAt_idx" ON "ReceiptVerification"("createdAt");
