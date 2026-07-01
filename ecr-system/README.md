# ECR System — Phase 1 Scaffold

Digitized Error Correction Report workflow for Velan Metrology.
Operator → Inspector → Senior Manager → General Manager → Store Manager,
with automated app + email notifications at every step.

## Phase 1 scope (this scaffold)

- Auth (JWT login, Admin-created users only, no self-signup)
- Admin: user management + master data (error types, components, vendors, cost rates)
- Defect report core workflow:
  - Operator raises → Inspector reviews → SM reviews → GM approves/rejects
  - Inspector or SM can also raise a report directly (skip-ahead logic built in)
  - GM has unrestricted field edit power; SM has scoped edit power — all edits audit-logged
- Automated notifications (email + in-app via Socket.IO) on every status change,
  with DB-backed retry cron (no Redis — free-tier friendly at 20-user scale)
- Full audit trail (status changes + field edits, old/new value)

## Not yet built (Phase 2/3, per plan)

- Component issuance (Store Manager) — entity exists, no controller yet
- Vendor fault log + cost recovery — entity exists, no controller yet
- Salary deduction — entity exists, no controller yet
- File upload for defect images (Cloudinary/local disk)
- Analytics dashboard endpoints
- Daily digest email / aging indicators
- Frontend (React + Vite)

## Setup

```bash
npm install
cp .env.example .env
# fill in DATABASE_URL (Neon free tier), JWT_SECRET, SMTP_* (Brevo free tier)
npm run start:dev
```

API runs on `http://localhost:3000/api`.

### First-time DB setup

`synchronize: true` is on in dev (`NODE_ENV != production`), so tables are
created automatically from entities on first run — no manual migration needed
to get started. Switch to migrations before production:

```bash
npm run migration:generate -- src/migrations/Init
npm run migration:run
```

### Creating the first Admin user

There's no seed script yet — insert directly via SQL once, then use the
Admin API for everyone else:

```sql
-- password hash for 'changeme123' - replace before real use
INSERT INTO users (name, email, "passwordHash", role, "isActive")
VALUES ('Admin', 'admin@velanmetrology.com', '<bcrypt-hash>', 'ADMIN', true);
```

## Key endpoints (Phase 1)

```
POST   /api/auth/login

GET    /api/admin/users
POST   /api/admin/users
PATCH  /api/admin/users/:id
DELETE /api/admin/users/:id        (soft delete / deactivate)

POST   /api/defect-reports                    (Operator/Inspector/SM)
GET    /api/defect-reports?status=&mine=true
GET    /api/defect-reports/:id
PATCH  /api/defect-reports/:id/inspect         (Inspector)
PATCH  /api/defect-reports/:id/sm-review       (Senior Manager)
PATCH  /api/defect-reports/:id/gm-approve      (General Manager)
PATCH  /api/defect-reports/:id/field           (SM scoped / GM unrestricted edit)

GET    /api/master-data/error-types
GET    /api/master-data/components
GET    /api/master-data/vendors
GET    /api/master-data/cost-rates

GET    /api/notifications?unread=true
PATCH  /api/notifications/:id/read
```

## Workflow skip-ahead logic (built into DefectReportsService.create)

| Raised by | Inline data required | Starting status |
|---|---|---|
| Operator | — | PENDING_INSPECTION |
| Inspector | `inlineInspection` | PENDING_SM_REVIEW |
| Senior Manager | `inlineInspection` + `inlineSmReview` | PENDING_GM_APPROVAL |

A user can never action a stage on a report they raised themselves
(enforced in service, not just UI).

## Free-tier stack

Neon PostgreSQL · EC2/Render free tier · Vercel/Netlify (frontend) ·
Brevo SMTP (300 emails/day free) · Socket.IO (self-hosted, no cost) ·
Sentry free tier · GitHub Actions — no Redis, no paid auth service.
