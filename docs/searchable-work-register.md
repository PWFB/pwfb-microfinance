# PWFB Searchable Work Register

The work register is an operational engineering/cleanup record. It is separate from the customer ledger, wallet transactions, loans, repayments, collections, cashbook, salary disbursements and receipt verification.

## Access

All endpoints require a valid PWFB bearer token.

- Read/search/summary/history: `SUPER_ADMIN`, `ADMIN`, `AUDITOR`
- Create/update/status changes: `SUPER_ADMIN`, `ADMIN`
- No delete route exists. Event history is append-only through the API.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/work-log` | Search and list work items |
| `GET` | `/work-log/summary` | Counts by status and open/total |
| `GET` | `/work-log/:reference` | Full item and event history |
| `POST` | `/work-log` | Create a work item |
| `PATCH` | `/work-log/:reference` | Update fields or status |

## Search examples

- Open work only (default): `GET /work-log`
- Search across references, sessions, titles, descriptions, categories, branches, commits and tags: `GET /work-log?q=dark+mode`
- Find one session: `GET /work-log?sessionKey=PWFB-SESSION-20261109&includeCompleted=true`
- Incomplete work: `GET /work-log?status=UNCOMPLETED`
- Blocked items: `GET /work-log?status=BLOCKED`
- Completed history: `GET /work-log?status=COMPLETED` or `GET /work-log?includeCompleted=true`
- Filter a category: `GET /work-log?category=BACKEND`

Pagination defaults to 25 and is capped at 100.

## Identifiers and statuses

- Each record receives `PWFB-WORK-YYYYMMDD-XXXXXXXXXXXXXXXX` as its unique work reference.
- Records default to a daily `PWFB-SESSION-YYYYMMDD` session key. Supply `sessionKey` to group several tasks into a named release or cleanup session; a backend environment variable `PWFB_WORK_SESSION_KEY` can set a shared key for a particular work run.
- Statuses: `TODO`, `IN_PROGRESS`, `BLOCKED`, `UNVERIFIED`, `COMPLETED`.
- Priorities: `LOW`, `NORMAL`, `HIGH`, `CRITICAL`.

A record cannot be marked `COMPLETED` without a verification summary and at least one traceable commit SHA, pull-request URL, deployment URL or evidence URL. Reopening a completed item requires a reason note. This validation ensures completion claims have a reference; it does not independently fetch or certify external URLs.

## Create example

```json
{
  "title": "Verify branch dashboard scope",
  "description": "Confirm that all branch totals use the signed-in staff member's assigned branch.",
  "category": "BACKEND",
  "priority": "HIGH",
  "status": "IN_PROGRESS",
  "sessionKey": "PWFB-SESSION-2026-11-BRANCH-SCOPE",
  "environment": "STAGING",
  "branch": "staging",
  "tags": ["access-control", "dashboard", "cleanup"],
  "note": "Added to the current backend cleanup run."
}
```

For a completed record, also supply `verificationSummary` and at least one of `commitSha`, `pullRequestUrl`, `deploymentUrl` or `evidenceUrl`.

## Persistence and deployment gate

Migration `20261109133000_searchable_work_register` is additive and is not yet applied. Do not seed or use the work register until the intended staging database is restored, confirmed and approved for migration. Never point this workflow at Neon unless the user explicitly designates that database for this environment. No financial or customer records are written by the work register itself.
