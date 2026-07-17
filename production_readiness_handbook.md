# Production Readiness & Operations Handbook

Velan Metrology — ECR System

---

## 1. Environment Setup Guide

The following configuration variables must be populated on Render (or alternative production environments). Server startup will immediately fail if these variables are absent:

| Variable | Type | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | String (URI) | Connection string for Neon PostgreSQL database. |
| `JWT_SECRET` | String | Cryptographic secret for signing session tokens. |
| `EMAIL_FROM` | String (Email) | Sender address for system notifications (e.g. gmail). |
| `GMAIL_APP_PASSWORD` | String | SMTP application-specific password for the email account (used locally). |
| `GMAIL_SCRIPT_URL` | String (URL) | Google Apps Script HTTP Web App proxy URL (Required for Render production deployment to bypass SMTP blocking). |
| `GMAIL_SCRIPT_TOKEN` | String | Secure authorization token matching the Google Apps Script Web App. |

---

## 2. Deployment Checklist

Before initiating production updates, follow this validation checklist:

- [ ] Run typescript checks and lint suites: `npm run lint --workspaces` and `npm run build`.
- [ ] Verify that all unit and integration test suites are completely green: `npx jest --workspace=ecr-system`.
- [ ] Run playwritght E2E journeys: `npx playwright test` to certify login and navigation flows.
- [ ] Confirm database connection pool status on the Neon console.
- [ ] Execute database migrations: `npm run migration:run`.

---

## 3. Rollback Checklist

In the event of deployment failure or regression:

- [ ] **Code Reversion:** Revert git HEAD to the last stable production tag on GitHub.
- [ ] **Database Migration Reversal:** Revert database migrations if the schema was altered:
  ```bash
  npm run typeorm migration:revert -d src/config/data-source.ts
  ```
- [ ] **Configuration Rollback:** Restore previous environment variables in the Render Dashboard and trigger a clean manual redeploy.

---

## 4. Backup & Recovery Strategy

### Neon PostgreSQL Backup
Neon cloud postgres automates daily backups with point-in-time recovery. To trigger manual snapshots, run:
```bash
pg_dump -d "postgresql://neondb_owner:npg_pJA2XQNTY9Db@ep-winter-water-at1ihqar-pooler.c-9.us-east-1.aws.neon.tech/neondb" -f backup_file.sql
```

### Recovery Verification
To restore backups onto a staging database or test instance:
```bash
psql -d "postgresql://<user>:<password>@<host>/<database>" -f backup_file.sql
```

---

## 5. Incident Response Checklist

### High CPU or Memory Overhead
1. Query monitoring metrics at `/api/admin/monitoring/dashboard` (restricted to Administrators).
2. Inspect log files for active query execution loops or unclosed database client connections.

### Mail Delivery Failures
1. View the live mail queue dashboard under `Admin > Email Queue` in the frontend sidebar navigation.
2. Confirm `GMAIL_APP_PASSWORD` environment variables are active and correct in the environment settings dashboard.
