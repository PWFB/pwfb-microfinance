# PWFB Microfinance — Deployment

## Purpose

This document describes the production deployment workflow for PWFB Microfinance.

## Source Repository

The production branch is `main`.

## Frontend

Production frontend: https://pwfb-frontend.onrender.com

The frontend is deployed through Render from the `main` branch.

## Local Build

Before pushing frontend changes:

```bash
cd ~/pwfb-microfinance-main/apps/frontend
npm run build
```

The production build must complete successfully before deployment.

## Git Workflow

From the repository root:

```bash
git status
git diff
git add <files>
git commit -m "Describe the change"
git push origin main
```

Only intended changes should be committed and pushed.

## Render Deployment

After pushing to `main`:

1. Confirm Render starts a new deployment.
2. Monitor the build logs.
3. Confirm the build succeeds.
4. Confirm the service starts successfully.
5. Open the production URL.
6. Verify the changed functionality.

## Production Verification

Verify login, dashboard, navigation, mobile layout, desktop layout, and the affected module after deployment.

## Deployment Safety

Never commit passwords, API keys, private keys, database credentials, authentication secrets, or production environment secrets.

## Rollback

If a deployment introduces a serious problem, identify the problematic commit and restore the last known-good version using the approved Git workflow.

## Release Checklist

- [ ] Code reviewed
- [ ] Local build successful
- [ ] Git changes verified
- [ ] Changes pushed to main
- [ ] Render build successful
- [ ] Production service running
- [ ] Login verified
- [ ] Dashboard verified
- [ ] Mobile layout verified
- [ ] Desktop layout verified
- [ ] Changed functionality verified

---

**PWFB Microfinance**

Perfect Wisdom for Better Ltd.
