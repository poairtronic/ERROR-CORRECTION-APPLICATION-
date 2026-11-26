# ECR Application — Render Deploy Log Audit & Remediation Report

**Report Date:** November 26, 2026  
**Target Service:** `error-correction-application.onrender.com` (`ecr-system`)  
**Deliverable:** [`docs/neon-optimization/RENDER-DEPLOY-LOG-AUDIT-AND-FIX-REPORT.md`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/docs/neon-optimization/RENDER-DEPLOY-LOG-AUDIT-AND-FIX-REPORT.md)

---

## 1. Deployment & Runtime Log Summary

The Render deployment succeeded (`==> Build successful`, `==> Your service is live`, `Nest application successfully started`, `Velan Quality Hub API running on port 3000`), early liveness bound on port `3000`, and migration `AddEmailProcessingAndResetEnums1783560000000` executed cleanly.

Three log entries were investigated:

| # | Log Entry | Root Cause | Action Taken / Status |
|---|---|---|---|
| **1** | `SMTP transport verification warning: connect ENETUNREACH 2607:f8b0:400e:c20::6c:587 - Local (:::0)` | `smtpOptions` and custom `getSocket` (`net.connect` / `tls.connect`) in [`gmail-smtp.service.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/gmail-smtp.service.ts#L48-L80) did not enforce `family: 4`, allowing Node/Nodemailer to attempt an outbound IPv6 connection on Render's IPv4-only container. | **FIXED IN CODE:** Added `family: 4` to `smtpOptions` and to both `net.connect` and `tls.connect` inside `getSocket`. |
| **2** | `Cannot GET /api/api/internal/approved-reports` (`404`) followed by `GET /api/internal/approved-reports` (`200`) | External caller (`v-smart-backend` / RM service) appended `/api/internal/approved-reports` to a base URL that already ended in `/api` on one request. Repository search confirmed [`internal.controller.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.controller.ts#L50) exposes only `/api/internal/approved-reports` (`200 OK`). | **EXTERNAL CALLER CONFIG:** No ECR code change needed; update the RM service's `ECR_API_URL` if it still sends `/api/api/...`. |
| **3** | `SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'` | Render's `DATABASE_URL` environment variable uses `?sslmode=require` rather than `?sslmode=verify-full`. Safe in `pg@8.22.0` (which aliases `require` to `verify-full`). | **EXTERNAL ENV VAR:** Update Render `DATABASE_URL` query param from `sslmode=require` to `sslmode=verify-full` to silence the `pg@9` deprecation warning. |

---

## 2. Verification Results (Post-Edit)

* **Unit Tests (`npx jest src/email/services/gmail-smtp.service.spec.ts --verbose` in `ecr-system`):** **PASS** — `1 passed, 1 total` suite; `12 passed, 12 total` tests (including `family: 4` assertion on `nodemailer.createTransport`).
* **Backend Build (`npm run build` in `ecr-system`):** **PASS** — `nest build` exited `0` with zero TypeScript errors.
* **Git Status:** Modified [`ecr-system/src/email/services/gmail-smtp.service.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/gmail-smtp.service.ts), [`ecr-system/src/email/services/gmail-smtp.service.spec.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/gmail-smtp.service.spec.ts), and added this report; not yet committed or pushed.
