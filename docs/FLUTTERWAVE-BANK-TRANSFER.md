# PWFB Flutterwave bank transfer setup

PWFB now supports Flutterwave as the configured external bank-transfer provider while retaining the existing NIBSS adapter.

## Provider selection

Set:

```text
BANK_TRANSFER_PROVIDER=FLUTTERWAVE
```

If this variable is not set, PWFB continues to use the existing NIBSS implementation.

## Required Render environment variables

Set these in the backend service environment, not in Git:

```text
BANK_TRANSFER_PROVIDER=FLUTTERWAVE
FLUTTERWAVE_SECRET_KEY=<Flutterwave secret key>
FLUTTERWAVE_WEBHOOK_SECRET_HASH=<Flutterwave webhook secret hash>
FLUTTERWAVE_CALLBACK_URL=https://pwfb-backend.onrender.com/webhooks/wallet/flutterwave
```

`FLUTTERWAVE_BASE_URL` is optional and defaults to:

```text
https://api.flutterwave.com/v3
```

For sandbox testing, set the base URL to the Flutterwave sandbox API URL appropriate for the v3 credentials being used.

## Customer withdrawal flow

1. PWFB calls Flutterwave account resolution before allowing a destination account to be used.
2. PWFB checks that the resolved beneficiary name matches the PWFB customer's name.
3. PWFB sends the NGN bank transfer to Flutterwave with a unique PWFB reference.
4. PWFB immediately reserves the wallet amount and records the withdrawal as `PENDING` unless Flutterwave has already returned a final successful status.
5. Flutterwave sends the transfer result to `/webhooks/wallet/flutterwave`.
6. PWFB verifies the `flutterwave-signature` using the configured webhook secret hash.
7. PWFB re-queries Flutterwave using the transfer ID before giving the webhook result authority over the wallet transaction.
8. `SUCCESSFUL` completes the withdrawal. `FAILED` refunds the reserved amount and marks the transaction failed.
9. The existing customer transaction history and wallet balance therefore reflect the provider's final result.

## Flutterwave dashboard

Configure the webhook URL as:

`https://pwfb-backend.onrender.com/webhooks/wallet/flutterwave`

Enable transfer webhook notifications and configure the same secret hash as `FLUTTERWAVE_WEBHOOK_SECRET_HASH`.

## Important

Do not commit real Flutterwave keys or webhook secrets to GitHub. Add them through Render's environment-variable settings.
