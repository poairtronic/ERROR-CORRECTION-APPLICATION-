# Deployment & Developer Operations Guide

This document describes onboarding setups, local launching, and production deployments on Render with Neon PostgreSQL.

---

## 1. Local Developer Setup

### Prerequisites
- **Node.js:** version 22 or later.
- **Package Manager:** npm (installed automatically with Node).
- **Database:** PostgreSQL (or connection parameters to Neon Sandbox).

### Onboarding Steps

1. **Clone the Repository:**
   ```bash
   git clone <repository-url>
   cd <project-folder>
   ```

2. **Install Root Node Modules:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a copy of `.env.example` in `ecr-system/` named `.env` and fill in your configurations:
   ```bash
   cp ecr-system/.env.example ecr-system/.env
   ```
   *Required variables:*
   - `PORT`: Server port (default: 3000)
   - `DATABASE_URL`: Postgres URL (`postgresql://...`)
   - `JWT_SECRET`: Random hash key for session cookies
   - `GMAIL_SCRIPT_URL`: Google Apps Script SMTP URL (for email dispatch proxy)
   - `GMAIL_SCRIPT_TOKEN`: Secure verification token

4. **Launch Backend Server:**
   ```bash
   cd ecr-system
   npm run start:dev
   ```
   The backend API will run on `http://localhost:3000`.

5. **Launch Frontend Client:**
   Open a separate terminal window:
   ```bash
   cd frontend
   npm run dev
   ```
   The React SPA will run on `http://localhost:5173`.

---

## 2. Render Cloud Deployment

The application is fully configured for deployment on the Render cloud platform.

### render.yaml Configuration
The root folder contains a `render.yaml` configuration describing the multi-service build instructions:

```yaml
services:
  # Backend API
  - type: web
    name: ecr-backend
    env: node
    buildCommand: npm run build
    startCommand: npm run start:prod
    envVars:
      - key: PORT
        value: 3000
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false

  # Frontend Client
  - type: web
    name: ecr-frontend
    env: static
    buildCommand: npm run build
    publishPath: dist
    routes:
      - type: rewrite
        src: /*
        dest: /index.html
```

### Neon PostgreSQL Configuration
When provisioning the database on Neon:
1. Copy the Connection String from the Neon dashboard.
2. In the Render environment configurations, set the `DATABASE_URL` key.
3. **SSL Mode Requirement:** Neon requires SSL mode connections. Ensure `sslmode=require` is appended to the connection string parameters:
   `postgresql://user:pass@host/db?sslmode=require`

### Scaling and High Availability
1. **Stateless Nodes:** Since file storage is outsourced to Cloudinary, application instances are entirely stateless and can be scaled horizontally without session-loss.
2. **Database Connection Limits:** On free/shared Neon tiers, monitor active connections. Ensure NestJS does not exceed PG database pool limits by configuring database connection pool sizes in NestJS configuration options if necessary.
