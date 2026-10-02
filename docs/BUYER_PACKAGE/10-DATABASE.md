# Database Handover

PostgreSQL is the production target and Prisma is the schema/migration authority.

Before sale:
- validate schema
- verify migration history
- reconcile runtime-created tables with migrations
- review financial precision and constraints
- test backup restoration
- document retention and recovery
