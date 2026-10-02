# Deployment

## Verification
```
npm ci
npm run check
npm run build
npm test
```

Production database changes use committed Prisma migrations:
```
npm exec --workspace=backend -- prisma migrate deploy --schema=prisma/schema.prisma
```

Do not use destructive `db push --accept-data-loss` for production.
