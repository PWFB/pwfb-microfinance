# Security Handover

Required controls:
- Production JWT secret is mandatory.
- CORS is restricted.
- Secrets are externalized.
- Authentication and authorization are tested by role.
- Financial mutations are authorized and auditable.
- Provider webhooks are verified before financial state changes.
- Uploads are validated and access-controlled.
- Database migrations are version-controlled.
- Backups and restoration are tested.

Final release requires dependency, secret, authorization, API, database and Android security review.
