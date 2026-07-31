# Enterprise Production Readiness Handbook - ECR Digitization System

This guide outlines deployment, environment configurations, backup strategies, recovery guides, and SRE operational checklists for the Velan Quality Hub.

---

## 🏗️ ARCHITECTURE SUMMARY

The application is structured as a Monolithic Node.js workspace built on NestJS (backend) and Vite/React (frontend).
- **Backend Rest API**: Runs NestJS, serving requests via HTTP on port `3000` (or configured `PORT`).
- **Frontend SPA**: Vite builds static React files directly into `ecr-system/public`, which is served by the NestJS static file server (`@nestjs/serve-static`) on the base path.
- **Database Layer**: PostgreSQL (Neon Serverless or Local) accessed via TypeORM.
- **Real-Time Layer**: WebSockets powered by Socket.IO for notification pushes and logs updating.

---

## 🛠️ ENVIRONMENT VARIABLES

Create a `.env` file in the `/ecr-system` root folder.

| Key | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `PORT` | App bind port | `3000` |
| `NODE_ENV` | Mode check | `production` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pwd@host-pooler.../neondb` |
| `JWT_SECRET` | Secret key for auth | *(A long, cryptographically secure random string)* |
| `JWT_EXPIRES_IN` | Token duration | `8h` |
| `GMAIL_SCRIPT_URL` | Apps Script HTTPS URL | `https://script.google.com/macros/s/.../exec` |
| `GMAIL_SCRIPT_TOKEN` | Script API security token | `ecr_secret_secure_mail_token_2026` |
| `GMAIL_APP_PASSWORD` | Fallback SMTP SMTP pwd | `qjgirdacnazaffrb` |
| `EMAIL_FROM` | Dispatch sender address | `posuppportairtronic@gmail.com` |
| `FRONTEND_URL` | CORS authorized origin | `https://error-correction-application.onrender.com` |

---

## 🚀 DEPLOYMENT GUIDE (Render Cloud)

1.  **Create Render Web Service**:
    - Build Command: `npm run render-build` (Runs `npm install` and Vite client builds automatically).
    - Start Command: `npm run render-start` (Starts compiled NestJS production bundle).
2.  **Attach Environment variables**: Set all variables from the table above in Render's dashboard.
3.  **Define Health Checks**: Path `/api/health/live` on port `3000`.

---

## 💾 BACKUP & RESTORATION PLAN (PostgreSQL)

Since the system runs on **Neon Serverless PostgreSQL**:
- **Point-in-Time Recovery (PITR)**: Neon automatically manages continuous backups, allowing you to restore database states to any second within the past 7 days via the Neon Console.
- **Manual Logical Backups**:
  ```bash
  # Take a backup dump
  pg_dump -d "postgresql://user:pwd@host/db" -F c -b -v -f ecr_db_backup.dump

  # Restore a backup dump
  pg_restore -d "postgresql://user:pwd@host/db" -v ecr_db_backup.dump
  ```

---

## 🚨 SRE OPERATIONAL CHECKLIST

- [ ] **Secrets Rotation**: Verify `JWT_SECRET` is rotated annually.
- [ ] **Logging Limits**: Confirm `NODE_ENV=production` is active to disable verbose DEBUG logs and keep Render storage clean.
- [ ] **Connection pool checks**: Ensure Neon pooler connection strings (port 5432 / pooled mode) are utilized under concurrent growth.
