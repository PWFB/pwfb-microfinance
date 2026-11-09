ALTER TABLE "Passkey"
  ADD COLUMN IF NOT EXISTS "rpId" TEXT;

-- Legacy rows are backfilled by AuthService with the configured Render RP ID
-- at runtime; newly registered browser passkeys store their request-host RP ID.
CREATE INDEX IF NOT EXISTS "Passkey_user_rpId_idx"
  ON "Passkey" ("userId", "rpId");
