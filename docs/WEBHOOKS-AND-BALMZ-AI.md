# PWFB Webhooks & BALMZ AI Operations Guide

## 1. Webhook security

PWFB financial webhooks are integration boundaries. Every production callback must use HTTPS and must be authenticated before a financial effect is applied.

### Provider credentials

Keep provider credentials server-side only. Recommended environment variable names include:

```text
FLUTTERWAVE_SECRET_KEY=<server secret>
FLUTTERWAVE_WEBHOOK_SECRET_HASH=<webhook signature secret>
FLUTTERWAVE_CALLBACK_URL=https://<pwfb-backend>/webhooks/wallet/flutterwave
PWFB_VIRTUAL_ACCOUNT_WEBHOOK_SECRET=<server boundary secret>
```

Do not put these values in frontend code, Git commits, screenshots, public documentation or client-side storage.

## 2. Webhook processing standard

1. Receive the request over HTTPS.
2. Validate the provider signature or PWFB webhook secret.
3. Validate event type and required fields.
4. Check the provider transaction/reference identifier.
5. Enforce idempotency so duplicate deliveries cannot create duplicate financial effects.
6. Apply the approved business operation inside the authenticated backend.
7. Record enough metadata for reconciliation and audit.
8. Return an appropriate acknowledgement promptly.
9. Monitor rejected, duplicated and failed events.

A webhook request must never be treated as proof of payment simply because it reached the endpoint.

## 3. Supported PWFB webhook areas

- Flutterwave payment and virtual-account callbacks.
- Paystack payment callbacks.
- Customer virtual-account event boundary.
- Wallet withdrawal reconciliation callbacks.

The exact route and provider configuration should be taken from the deployed backend configuration rather than copied into frontend secrets.

## 4. BALMZ AI purpose

BALMZ AI is the PWFB intelligence layer for supervised operational assistance. It can:

- inspect supported financial-operational records for configured integrity checks;
- identify and explain basic anomalies;
- help the Super Admin investigate operational problems;
- answer questions about supported PWFB workflows;
- assist with API/integration explanations;
- provide receipt-verification assistance.

## 5. BALMZ AI governance

BALMZ AI recommendations are not a substitute for accounting review, compliance review or human authorization. Do not allow an AI response alone to approve a loan, settle a payment, change a customer balance or release funds.

AI credentials remain server-side:

```text
OPENAI_API_KEY=<server secret>
BALMZ_AI_MODEL=<approved model>
BALMZ_AI_VISION_MODEL=<approved vision model>
```

Never place API keys in browser bundles or prompts.

## 6. Financial integrity audit interpretation

- **HEALTHY:** configured checks found no basic anomaly.
- **WARNING:** one or more findings need human review.
- **CRITICAL:** a finding may represent a material integrity or operational risk and should be investigated promptly.

A healthy audit is not a guarantee that every accounting, compliance or business-rule issue is absent.

## 7. Receipt verification

Receipt verification is an evidence-assistance workflow. A receipt should be matched against the corresponding PWFB transaction, customer/account, amount, date and provider evidence before settlement is accepted.

## 8. Production checklist

- HTTPS enabled.
- Provider callback configured.
- Signature/secret verification enabled.
- Duplicate-event protection implemented.
- Provider reference stored.
- Financial effects performed only after validation.
- Error/rejection monitoring available.
- AI keys stored in server-side secret management.
- Human approval retained for consequential financial decisions.
- Documentation kept synchronized with deployed routes.
