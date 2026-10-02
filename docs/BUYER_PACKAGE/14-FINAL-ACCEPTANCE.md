# Final Buyer Acceptance

- [ ] Clean checkout installs
- [ ] Root check passes
- [ ] Backend/frontend builds pass
- [ ] Backend/frontend tests pass
- [ ] Prisma migration verification passes
- [ ] Core financial workflows pass
- [ ] Role/permission tests pass
- [ ] Authentication tests pass
- [ ] Banking/provider tests pass
- [ ] Signed Android APK test passes
- [ ] Signed AAB produced
- [ ] Deployment passes
- [ ] Security review passes
- [ ] Documentation complete
- [ ] IP transfer inventory complete
- [ ] Demo environment ready
- [ ] Final release tag/source archive created

Buyer acceptance must reference a specific immutable release/tag and test report.


## Evidence log — 2026-10-02 cleanup pass

- Cleanup branch: `sale-ready-cleanup-2026-10-02`
- Pull request: #18 (draft)
- Migration ownership was extended to runtime-created support tables through migration `20261002120000_sale_ready_runtime_tables`.
- Production JWT fallback was removed from the JWT strategy; test-only fallback remains limited to `NODE_ENV=test`.
- Production CORS no longer includes localhost defaults.
- Customer temporary passwords now use cryptographic randomness instead of `Math.random()`.
- ATM card UI explicitly clears the full PAN/CVV from the client after submission and the database model stores only the last four digits plus non-sensitive metadata/images.
- CI/deployment evidence is still pending on the current branch; this document is not a final acceptance record.
