# ECR Application — Task 1: Phase 6 Email Queue Safety and Recovery Audit
## Strict Read-Only Source-Code Verification Report

**Audit Date:** November 26, 2026  
**Scope:** Phase 6 Email Queue & Background Worker Optimization (`ecr-system`)  
**Audit Type:** Independent Strict Read-Only Forensic Audit  
**Deliverable:** [`docs/neon-optimization/TASK-1-PHASE-6-EMAIL-QUEUE-SAFETY-AUDIT.md`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/docs/neon-optimization/TASK-1-PHASE-6-EMAIL-QUEUE-SAFETY-AUDIT.md)  
**Final Verdict:** **FAIL** *(Multiple confirmed material defects exist in recovery atomicity, startup/cron lifecycle, concurrency event handling, retry logic, shutdown safety, and schema/migration alignment.)*

---

## 1. Executive Summary

An independent, read-only source-code audit was performed on the Phase 6 email queue optimization in `ecr-system` without modifying any application code, configuration, schema, or tests.

While Phase 6 successfully reduced idle polling frequency (from `@Cron(CronExpression.EVERY_MINUTE)` to `@Cron(process.env.EMAIL_QUEUE_CRON || CronExpression.EVERY_30_MINUTES)`) and added an atomic `UPDATE ... WHERE id = :id AND status IN ('PENDING', 'FAILED')` claim query inside `processEmailQueue()`, **the overall queue safety and recovery design is NOT production-safe under concurrent instances, transient failures, restarts, or graceful shutdown.**

### Key Audit Determinations
* **Final Verdict:** **FAIL** — Material safety defects are **CONFIRMED** directly in source code.
* **Delivery Guarantee:** **At-least-once** (when startup recovery triggers, and only if the process actually restarts > 10 minutes after a crash); **NOT exactly-once**. Duplicate delivery is unprevented across crashes after Gmail acceptance, ambiguous timeouts, and non-atomic recovery races.
* **Critical Gaps Found:**
  1. `recoverStuckProcessingEmails()` performs a non-atomic `getMany()` + unconditional `save()` race (`email-queue.service.ts:58-77`) and runs **only at startup** (`onModuleInit()`), never periodically — stranding crashed/timed-out `PROCESSING` jobs indefinitely when an instance restarts within 10 minutes or another instance remains up.
  2. The atomic claim `try/catch` block (`email-queue.service.ts:269-288`) silently swallows any DB error and falls back to unconditional `emailLogRepo.save(email)`, bypassing multi-instance locking.
  3. Final persistence (`email-queue.service.ts:385`) executes an unconditional `save(email)` of the pre-claim entity without checking `WHERE status = 'PROCESSING'`, allowing stale workers to overwrite `SENT`, `CANCELLED`, or re-claimed rows.
  4. Migration `1783487119085-PostgresMigration.ts:39` defines PostgreSQL enum `email_logs_status_enum` **without `'PROCESSING'`** (`'PENDING'`, `'SENT'`, `'FAILED'`, `'CANCELLED'`), and no migration or startup `ALTER TYPE` adds `'PROCESSING'` while `synchronize` is `false` in production (`app.module.ts:93`).
  5. Single-process guard `if (this.isProcessing) return;` (`email-queue.service.ts:182-185`) silently drops `'email.logs.updated'` events, `scheduleRetry()` timers, and `scheduleBatchContinuation(12000)` timers that fire while a batch is active, stalling pending/failed emails for up to 30 minutes.
  6. `retryDelays = [2, 5, 15]` (`email-queue.service.ts:211`) never uses the `15s` delay because `this.maxRetries = 3` (`line 31`) transitions `retryCount === 3` straight to `CANCELLED` (`line 366`), and `EmailService.sendEmailViaApi()` overwrites error `.status = 500`, causing permanent GAS errors to be retried as transient.
  7. `beforeApplicationShutdown()` (`email-queue.service.ts:145-162`) clears timers and waits up to 10s, **does NOT cancel active Gmail HTTP/SMTP requests**, logs `'Email queue drained successfully.'` even after timeout, and precedes `TypeOrmCoreModule.onApplicationShutdown()` (`dataSource.destroy()`), stranding >10s sends in `PROCESSING`.
  8. Unit tests (`email-queue.service.spec.ts`) run entirely against Jest mocks and provide zero proof of real PostgreSQL locking, multi-instance safety, crash-after-send behavior, or in-flight shutdown behavior.

---

## 2. Files Inspected

### Primary Target Files
* [`ecr-system/src/email/services/email-queue.service.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts) (lines 1–405)
* [`ecr-system/src/email/services/email-queue.service.spec.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.spec.ts) (lines 1–247)

### Email Module, Entities, Migrations & Callers
* [`ecr-system/src/email/email.module.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/email.module.ts) (lines 1–21)
* [`ecr-system/src/email/entities/email-log.entity.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/entities/email-log.entity.ts) (lines 1–74)
* [`ecr-system/src/email/entities/notification-preference.entity.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/entities/notification-preference.entity.ts) (lines 1–44)
* [`ecr-system/src/email/enums/email-status.enum.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/enums/email-status.enum.ts) (lines 1–7)
* [`ecr-system/src/email/enums/notification-event.enum.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/enums/notification-event.enum.ts) (lines 1–14)
* [`ecr-system/src/email/services/email.service.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email.service.ts) (lines 1–438)
* [`ecr-system/src/email/services/gmail-smtp.service.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/gmail-smtp.service.ts) (lines 1–190)
* [`ecr-system/src/email/services/email-template.service.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-template.service.ts) (lines 1–205)
* [`ecr-system/src/email/email.controller.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/email.controller.ts) (lines 1–145)
* [`ecr-system/src/email-monitoring/email-monitoring.service.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email-monitoring/email-monitoring.service.ts) (lines 1–441)
* [`ecr-system/src/email-monitoring/email-monitoring.controller.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email-monitoring/email-monitoring.controller.ts) (lines 1–82)
* [`ecr-system/src/notifications/notifications.service.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/notifications/notifications.service.ts) (lines 1–181)
* [`ecr-system/src/notifications/notification.listener.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/notifications/notification.listener.ts) (lines 1–258)
* [`ecr-system/src/notifications/notifications.gateway.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/notifications/notifications.gateway.ts) (lines 1–236)
* [`ecr-system/src/notifications/notification-retry.cron.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/notifications/notification-retry.cron.ts) (lines 1–70)
* [`ecr-system/src/auth/auth.service.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/auth/auth.service.ts) (lines 1–225)
* [`ecr-system/src/defect-reports/defect-reports.service.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports.service.ts) (lines 1–120)

### Bootstrap, Database Config, Migrations & Infrastructure
* [`ecr-system/src/main.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/main.ts) (lines 1–86)
* [`ecr-system/src/app.module.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/app.module.ts) (lines 1–133)
* [`ecr-system/src/config/data-source.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/config/data-source.ts) (lines 1–13)
* [`ecr-system/src/common/utils/retry.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/common/utils/retry.ts) (lines 1–44)
* [`ecr-system/src/common/trace-context.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/common/trace-context.ts) (lines 1–28)
* [`ecr-system/src/migrations/1783487119085-PostgresMigration.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/migrations/1783487119085-PostgresMigration.ts) and subsequent migrations (`1783488677821` through `1783550000000`)
* [`ecr-system/update-db-enum.js`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/update-db-enum.js), [`render.yaml`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/render.yaml), [`ecr-system/.env.example`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/.env.example)

### Related Test Suites & Prior Documentation
* [`ecr-system/src/email/services/email.service.spec.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email.service.spec.ts)
* [`ecr-system/src/email/services/gmail-smtp.service.spec.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/gmail-smtp.service.spec.ts)
* [`ecr-system/src/email/services/email-template.service.spec.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-template.service.spec.ts)
* [`ecr-system/src/email/email.controller.spec.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/email.controller.spec.ts)
* [`ecr-system/src/email-monitoring/email-monitoring.service.spec.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email-monitoring/email-monitoring.service.spec.ts)
* [`ecr-system/src/email-monitoring/email-monitoring.controller.spec.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email-monitoring/email-monitoring.controller.spec.ts)
* [`docs/neon-optimization/PHASE-6-ECR-EMAIL-QUEUE-REPORT.md`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/docs/neon-optimization/PHASE-6-ECR-EMAIL-QUEUE-REPORT.md) & [`PHASE-8-ECR-FINAL-AUDIT-REPORT.md`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/docs/neon-optimization/PHASE-8-ECR-FINAL-AUDIT-REPORT.md)
* Installed runtime packages inspected (read-only): `typeorm@0.3.31` (`PostgresDriver.js`, `PostgresQueryRunner.js`, `UpdateQueryBuilder.js`), `pg@8.12.0+` (`utils.js`), `@nestjs/core` (`on-module-init.hook.js`, `before-app-shutdown.hook.js`, `nest-application-context.js`, `nest-application.js`), `@nestjs/typeorm` (`typeorm-core.module.js`), `@nestjs/schedule` (`scheduler.orchestrator.js`), `@nestjs/event-emitter` (`event-subscribers.loader.js`).

---

## 3. Existing Implementation Explained

The email delivery pipeline operates across four components:
1. **Queue Producers:**
   - [`EmailService.queueEmail()`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email.service.ts#L232-L343) renders HTML via `EmailTemplateService`, writes an `EmailLog` row to PostgreSQL (`status = 'PENDING'`), and emits `'email.logs.updated'` via `EventEmitter2`. It is called by `NotificationsService.create()` (`notifications.service.ts:96`), `AuthService.forgotPassword()` (`auth.service.ts:135`), and `EmailController` test endpoints (`email.controller.ts:76, 91`).
   - Re-queue paths exist in [`EmailService.resend()`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email.service.ts#L345-L356) (emits `'email.logs.updated'`), [`EmailMonitoringService.retryAllFailed()`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email-monitoring/email-monitoring.service.ts#L353-L390) (emits `'email.logs.updated'`), and [`EmailMonitoringService.resend()` / `retry()`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email-monitoring/email-monitoring.service.ts#L283-L329) (which do **not** emit `'email.logs.updated'`).
2. **Startup Lifecycle ([`EmailQueueService.onModuleInit()`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L34-L53)):**
   - Sequentially awaits `recoverStuckProcessingEmails()` (10-minute cutoff), `recoverGasQuotaExceededEmails()`, and `processEmailQueue()`, wrapped in a `try/catch` that logs a warning and swallows startup errors.
3. **Worker Execution ([`EmailQueueService.processEmailQueue()`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L169-L403)):**
   - Decorated with both `@Cron(process.env.EMAIL_QUEUE_CRON || CronExpression.EVERY_30_MINUTES)` and `@OnEvent('email.logs.updated')`.
   - Protected by in-memory flags `isShuttingDown` and `isProcessing` (`lines 178-186`).
   - Queries up to 100 `PENDING` or `FAILED` rows ordered by `createdAt ASC` (`lines 194-201`), filters `FAILED` rows by backoff `retryDelays = [2, 5, 15]` (`lines 210-229`), schedules an in-memory `setTimeout` (`scheduleRetry`) if any `FAILED` email is waiting for backoff (`lines 232-234`), slices the first 5 eligible emails (`line 237`), and schedules `scheduleBatchContinuation(12000)` if `eligibleEmails.length > 5` (`lines 241-243`).
   - Processes the batch concurrently via `Promise.all` (`lines 266-388`): attempts an atomic `UPDATE` to `PROCESSING`, runs up to 3 inner send attempts (`1s`, `2s` sleeps) calling `emailService.sendEmailViaApi(email)`, classifies failure retryability only after all 3 inner attempts fail (`line 346`), schedules an in-memory retry (`line 380`) or cancels at `retryCount >= 3` (`line 366`), and saves the mutated `email` entity (`line 385`).
4. **Provider Layer ([`EmailService`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email.service.ts#L44-L227) & [`GmailSmtpService`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/gmail-smtp.service.ts#L98-L181)):**
   - Uses Google Apps Script (HTTPS `fetch` wrapped in `retryWithBackoff` with `maxAttempts: 3`) and/or direct Gmail SMTP (`nodemailer` on `smtp.gmail.com:587`), with cross-provider fallback inside `sendEmailViaApi()`.
5. **Shutdown Lifecycle ([`EmailQueueService.beforeApplicationShutdown()`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L145-L162)):**
   - Enabled via `app.enableShutdownHooks()` (`main.ts:16`). Sets `isShuttingDown = true`, clears `activeTimers`, and polls `while (this.isProcessing)` every 100ms up to 10s.

---

## 4. Stuck-Job Recovery Analysis

### Source Code Responsible
* [`ecr-system/src/email/services/email-queue.service.ts:34-40`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L34-L40) (`onModuleInit` calling `recoverStuckProcessingEmails()`)
* [`ecr-system/src/email/services/email-queue.service.ts:58-77`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L58-L77) (`recoverStuckProcessingEmails`)
* [`ecr-system/src/email/entities/email-log.entity.ts:44-49, 72-73`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/entities/email-log.entity.ts#L44-L49) (`status` column, `@UpdateDateColumn() updatedAt`)

### Detailed Findings

1. **Stale-Job Threshold & Configurability** — **CONFIRMED**
   - `recoverStuckProcessingEmails(stuckThresholdMs = 10 * 60 * 1000)` (`email-queue.service.ts:58`) defaults to **10 minutes (600,000 ms)**.
   - The method parameter allows programmatic override (e.g., unit tests), but `onModuleInit()` calls `this.recoverStuckProcessingEmails()` with no arguments (`line 37`). There is **no environment variable or `ConfigService` setting** (even though `configService` is injected at `line 26` and never referenced anywhere in `EmailQueueService`).

2. **No Conditional Status Check on Database Update (Non-Atomic `getMany` + `save`)** — **CONFIRMED (MATERIAL DEFECT)**
   - Lines 60–64 query `SELECT ... FROM email_logs log WHERE log.status = 'PROCESSING' AND log.updatedAt < :cutoff`.
   - Lines 70–75 mutate the returned entities in memory and execute `await this.emailLogRepo.save(stuckEmails)`.
   - TypeORM `Repository.save()` emits an unconditional `UPDATE "email_logs" SET "status" = 'PENDING', "failureReason" = ... WHERE "id" = $1` **without** `AND "status" = 'PROCESSING' AND "updatedAt" < $2`.
   - **Consequences:**
     - *TOCTOU race with finishing worker:* If Instance A finishes sending a slow email and writes `SENT` between Instance B's `getMany()` (`line 64`) and `save()` (`line 75`), Instance B overwrites `SENT` back to `PENDING`, forcing a duplicate send.
     - *TOCTOU race between two starting instances:* If Instance B and Instance C boot concurrently, both read the same stuck row. Instance B saves `PENDING`, claims it (`PROCESSING`), and starts sending; Instance C's delayed `save(stuckEmails)` then overwrites Instance B's active `PROCESSING` row back to `PENDING`, causing Instance C (or another worker) to send a duplicate.

3. **Timestamp Consistency Across Node.js & PostgreSQL** — **CONFIRMED (DEFECT)**
   - Cutoff is computed in Node.js memory: `const cutoff = new Date(Date.now() - stuckThresholdMs);` (`line 59`).
   - Claim timestamp is also computed in Node.js memory: `.set({ status: EmailStatus.PROCESSING, updatedAt: new Date() })` (`line 273`).
   - However, [`1783487119085-PostgresMigration.ts:40`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/migrations/1783487119085-PostgresMigration.ts#L40) defines `"updatedAt" TIMESTAMP NOT NULL DEFAULT now()` (**`TIMESTAMP WITHOUT TIME ZONE`**).
   - Verified directly against installed `pg` (`node_modules/pg/lib/utils.js` `prepareValue(Date)`): `node-postgres` formats JS `Date` objects using the Node process's local timezone offset (e.g., `+05:30` on non-UTC hosts), which PostgreSQL strips when storing into `TIMESTAMP WITHOUT TIME ZONE`, whereas database `now()` uses the PostgreSQL session timezone (Neon default `UTC`). Additionally, multi-instance host clock skew affects comparisons between Node `Date.now()` (`line 59`) and another instance's `new Date()` (`line 273`).

4. **Can Recovery Reset an Email That Is Still Actively Being Sent?** — **CONFIRMED (YES)**
   - **Via legitimate long-running sends (> 10 minutes):** `updatedAt` is stamped once upon claiming (`line 273`) and is never heartbeated. A single email send in `processEmailQueue()` executes up to 3 outer attempts (`lines 294-343`); each attempt invokes `sendEmailViaApi()`, which can run `sendMailViaGas()` (`gmail-smtp.service.ts:118-139`) with 3 internal `retryWithBackoff` `fetch()` calls (**with no `AbortController` or HTTP timeout**; Node `undici` default timeouts can take minutes per attempt) plus Nodemailer SMTP fallback (`connectionTimeout: 10000`, `greetingTimeout: 10000`, **no `socketTimeout`** at `gmail-smtp.service.ts:43-53`). A hanging GAS/SMTP network path can keep a worker active past 10 minutes while another starting instance resets its status to `PENDING`.
   - **Via non-atomic concurrent startup race:** As shown in #2 above, two instances starting near-simultaneously can reset an email that was *just* recovered and started 0 seconds earlier.

5. **Startup-Only Recovery Leaves Stranded `PROCESSING` Jobs Across Fast Restarts or Multi-Instance Crashes** — **CONFIRMED (MATERIAL DEFECT)**
   - Contrary to the claim in [`PHASE-8-ECR-FINAL-AUDIT-REPORT.md:97`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/docs/neon-optimization/PHASE-8-ECR-FINAL-AUDIT-REPORT.md#L97) (*"Stuck-Job Recovery: Handled at startup + 30m cron fallback"*), `recoverStuckProcessingEmails()` is **only** invoked in `onModuleInit()` (`line 37`). `processEmailQueue()` (`line 194`) only queries `PENDING` and `FAILED`.
   - If Instance A crashes or times out on shutdown at `T=0s` after claiming a job (`updatedAt = T=0s`) and Render restarts the container at `T=15s`, `onModuleInit()` checks `updatedAt < T - 600s`, finds nothing, and returns `0`. That `PROCESSING` job will **never** be recovered by the 30-minute cron and stays permanently stuck until another container restart occurs > 10 minutes later.
   - Similarly, if one instance in a multi-instance deployment crashes and is not replaced (or before it restarts), healthy sibling instances never recover its stuck `PROCESSING` emails.
   - Additionally, `recoverStuckProcessingEmails()` (`lines 70-73`) does **not** increment `retryCount`, creating an unbounded crash-loop risk if a poison-pill email consistently triggers OOM/process crash.

6. **Quota Recovery Over-Matching & Non-Atomic Save (`recoverGasQuotaExceededEmails`)** — **CONFIRMED**
   - `recoverGasQuotaExceededEmails()` (`email-queue.service.ts:79-106`) also uses `getMany()` + unconditional `save()`.
   - Line 87 matches `log.failureReason LIKE '%Google Apps Script error%'`. Because [`EmailService.sendEmailViaApi()`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email.service.ts#L177-L185) prefixes **every** GAS failure with `'Google Apps Script error: ...'`, every boot resets *all* permanently `CANCELLED` GAS failures (not only quota errors) back to `PENDING` with `retryCount = 0`.

---

## 5. Multi-Instance Concurrency Analysis

### Database-Enforced Guarantees vs. In-Memory Protections

| Mechanism | Scope | Enforcement Layer | Verdict |
| :--- | :--- | :--- | :--- |
| `this.isProcessing` (`lines 19, 182`) | Single Node.js process | In-memory boolean | **NOT** a distributed lock; also drops overlapping local events/timers |
| `this.activeTimers` (`lines 21, 112-143`) | Single Node.js process | In-memory `Set<NodeJS.Timeout>` | Not shared or coordinated across instances |
| `this.isShuttingDown` (`lines 20, 147, 178`) | Single Node.js process | In-memory boolean | Local to shutting-down container |
| `gasQuotaExceededUntil` (`gmail-smtp.service.ts:14`) | Single Node.js process | In-memory timestamp | Not shared across instances |
| Atomic claim `UPDATE ... WHERE id = :id AND status IN ('PENDING', 'FAILED')` (`lines 270-283`) | Cluster-wide | PostgreSQL row lock | **ONLY** database-enforced guard — but compromised by `catch` fallback, missing enum migration, and unconditional final `save()` |

### Detailed Findings

1. **Can Two Instances Claim the Same Email?** — **CONFIRMED (POSSIBLE UNDER SPECIFIC FAILURE/RACE CONDITIONS)**
   - **Normal steady-state execution:** Assuming PostgreSQL accepts `'PROCESSING'` and `execute()` succeeds, `UpdateQueryBuilder` (`lines 270-278`) issues:
     `UPDATE "email_logs" SET "status" = 'PROCESSING', "updatedAt" = $1 WHERE id = $2 AND status IN ('PENDING', 'FAILED')`.
     Verified in `node_modules/typeorm/driver/postgres/PostgresQueryRunner.js`: `pg`'s `raw.rowCount` populates `UpdateResult.affected`. PostgreSQL acquires a row-level write lock on the target row; the first instance receives `affected = 1`, and the second instance re-evaluates the `WHERE` predicate after lock release, sees `status = 'PROCESSING'`, receives `affected = 0`, and skips (`lines 280-283`).
   - **Critical Bypass — Silent `catch` Fallback (`lines 284-288`):**
     ```ts
     } catch {
       // Graceful fallback for mock repositories in unit testing environments
       email.status = EmailStatus.PROCESSING;
       await this.emailLogRepo.save(email);
     }
     ```
     If `createQueryBuilder()...execute()` throws **any** database error in production (transient Neon connection reset, query timeout, deadlock, serialization error, or missing enum value), the `catch` block silently swallows the exception without logging and executes `await this.emailLogRepo.save(email)`. That `save()` issues an **unconditional** `UPDATE ... WHERE id = $1` with **no status predicate**, allowing Instance B to overwrite Instance A's `PROCESSING` (or `SENT`) status and send the same email concurrently.

2. **Schema/Migration Defect: `'PROCESSING'` Missing from `email_logs_status_enum`** — **CONFIRMED IN CODEBASE / LIVE NEON DB NOT VERIFIED**
   - [`email-log.entity.ts:44-49`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/entities/email-log.entity.ts#L44-L49) declares `status` with `type: 'simple-enum'`.
   - Verified in `node_modules/typeorm/driver/postgres/PostgresDriver.js:762-764`: TypeORM maps `simple-enum` on PostgreSQL identically to `"enum"` (a native Postgres `ENUM` type).
   - [`1783487119085-PostgresMigration.ts:39-40`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/migrations/1783487119085-PostgresMigration.ts#L39-L40) creates `email_logs_status_enum` as `ENUM('PENDING', 'SENT', 'FAILED', 'CANCELLED')` — **omitting `'PROCESSING'`** (and omitting `'PasswordReset'` from `email_logs_event_enum` and column `providerMessageId`).
   - No subsequent migration (`1783488677821` through `1783550000000`) alters `email_logs_status_enum`, `DefectReportsService.onModuleInit()` only runs `ALTER TYPE` on `defect_reports_status_enum` and `inspection_details_responsibleparty_enum` (`defect-reports.service.ts:60-66`), and `synchronize` is disabled in production (`app.module.ts:93`).
   - *Impact on a migration-initialized DB:* `recoverStuckProcessingEmails()` throws `invalid input value for enum email_logs_status_enum: "PROCESSING"` (causing `onModuleInit()` to swallow the error and abort quota recovery + startup flush), and `processEmailQueue()` hits the `catch` fallback and crashes again on `save(email)`. *(Whether the live Neon production DB had `'PROCESSING'` applied out-of-band is **NOT VERIFIED** under strict read-only audit rules.)*

3. **Unconditional Final `save(email)` Overwrites Concurrent State (`line 385`)** — **CONFIRMED (MATERIAL DEFECT)**
   - After `sendEmailViaApi()` finishes, `await this.emailLogRepo.save(email)` (`line 385`) writes the entire stale `email` entity loaded at `line 194` by primary key `id`, without `WHERE status = 'PROCESSING'`.
   - If another instance recovered a slow email and re-claimed it, or an admin cancelled/resent the email via `EmailMonitoringService.cancel()`/`resend()`/`retry()` while Instance A was mid-send, Instance A's final `save(email)` blindly overwrites the newer database state.
   - Similarly, if Instance A fails on `PENDING` (`retryCount: 0 -> 1`) and saves `FAILED`, while Instance B had stalled after `find()` at `line 194` with the same row (`status: PENDING, retryCount: 0`), Instance B's subsequent `UPDATE ... WHERE status IN ('PENDING', 'FAILED')` **matches** Instance A's new `FAILED` status, bypassing the 2s backoff delay and overwriting `retryCount` with a stale increment (`0 + 1 = 1` instead of `2`).

4. **Startup Recovery Interference & Multiple Startup Queue Flushes** — **CONFIRMED**
   - Multiple instances booting concurrently each call `onModuleInit()` -> `recoverStuckProcessingEmails()` -> `recoverGasQuotaExceededEmails()` -> `processEmailQueue()`.
   - Because both recovery methods use non-atomic `getMany()` + `save()`, an instance completing recovery slightly later can overwrite rows that an earlier-booted instance already started processing (`PROCESSING`) or finished (`SENT`).
   - Furthermore, all instances run `ORDER BY createdAt ASC LIMIT 100` (`lines 199-200`) and slice `eligibleEmails.slice(0, 5)` (`line 237`) **before** claiming (`line 270`), so two instances flushing on startup contend on the exact same 5 rows; the loser skips them (`affected = 0`) and **still schedules `scheduleBatchContinuation(12000)`** (`line 242`) if `eligibleEmails.length > 5`.

5. **In-Memory `isProcessing` Guard Drops Local Events & Timers** — **CONFIRMED (MATERIAL DEFECT)**
   - `if (this.isProcessing) { ... return; }` (`lines 182-185`) does **not** record a `pendingRescan` flag.
   - If a new email is queued (`@OnEvent('email.logs.updated')`) while a batch of `<= 5` emails is in flight (`isProcessing === true`), the event is permanently discarded and the newly queued email waits up to **30 minutes** for the fallback cron. (Previously with a 1-minute cron, maximum stall was 60 seconds.)

---

## 6. Duplicate Email Delivery Analysis

### Scenario Trace (Crash After Gmail Acceptance)
1. Instance A claims email `E1` (`UPDATE ... SET status = 'PROCESSING' ...` returns `affected = 1`).
2. Instance A calls `await this.emailService.sendEmailViaApi(email)` (`line 303`).
3. Gmail (SMTP or Google Apps Script) accepts and delivers the message.
4. Instance A crashes (SIGKILL / OOM / host failure / `dataSource.destroy()` after 10s shutdown timeout) **before** `await this.emailLogRepo.save(email)` (`line 385`) commits `status = 'SENT'`.
5. Instance B starts (`onModuleInit()`) after `> 10 minutes` since `updatedAt` and runs `recoverStuckProcessingEmails()` (`line 37`), resetting `E1` to `status = 'PENDING'`.
6. Instance B calls `processEmailQueue()` (`line 49`), claims `E1`, and invokes `sendEmailViaApi(email)` again — **sending a duplicate email to the recipient.**

### Findings

1. **Prevention of Crash-After-Send Duplication** — **NOT FOUND (NOT PREVENTED)**
   - There is no distributed transaction or coordination across Gmail/GAS and PostgreSQL.
   - `EmailQueueService` discards the `{ messageId, responseCode, responseBody }` return object from `sendEmailViaApi(email)` at `line 303` and never persists [`EmailLog.providerMessageId`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/entities/email-log.entity.ts#L67).
   - No idempotency token is forwarded to Gmail or Google Apps Script, and recovery does not reconcile against sent records.
   - Even **without** a crash, ambiguous network errors/timeouts after Gmail/GAS accepts the payload trigger duplicate sends within a single healthy instance: `GmailSmtpService.sendMailViaGas()` retries `fetch()` up to 3 times (`gmail-smtp.service.ts:118-139`), `EmailService.sendEmailViaApi()` falls back from GAS to Direct SMTP (`email.service.ts:171-172`) or vice versa (`line 206-207`), and `EmailQueueService` wraps all of this in 3 inner attempts (`line 298`) and up to 3 outer retry cycles.
   - Note: [`PHASE-6-ECR-EMAIL-QUEUE-REPORT.md:183`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/docs/neon-optimization/PHASE-6-ECR-EMAIL-QUEUE-REPORT.md#L183) states *"Duplicate email deliveries are strictly prevented without requiring Redis, Redlock, or RabbitMQ."* That claim is **FALSE**.

2. **Delivery Guarantee Classification** — **CONFIRMED: At-Least-Once (with Stranded-Job Gap), NOT Exactly-Once**
   - **Classification:** **At-least-once** when startup recovery runs after > 10 minutes (and note: **NOT** guaranteed delivery if a `PROCESSING` crash is followed by a `< 10 minute` restart with no later restart, because stranded `PROCESSING` rows are not recovered periodically).
   - **Not At-Most-Once:** Crashes/timeouts/recovery races re-queue and re-send already-accepted messages.
   - **Not Exactly-Once:** No atomic commit boundary or provider-side deduplication exists between PostgreSQL and Gmail/GAS.

---

## 7. Retry and Batch-Processing Analysis

### Source Code Responsible
* [`ecr-system/src/email/services/email-queue.service.ts:31, 112-136, 169-264, 292-386`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L169-L386)
* [`ecr-system/src/email/services/email.service.ts:154-226`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email.service.ts#L154-L226)
* [`ecr-system/src/email-monitoring/email-monitoring.service.ts:283-329`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email-monitoring/email-monitoring.service.ts#L283-L329)

### Detailed Findings

1. **Retry Delays of 2s, 5s, and 15s (`15s` Is Unreachable Dead Code)** — **CONFIRMED (DEFECT)**
   - `this.maxRetries = 3` (`line 31`) and `const retryDelays = [2, 5, 15];` (`line 211`).
   - Trace from initial `PENDING` (`retryCount = 0`):
     - Failure #1: `retryCount` becomes `1` (`line 347`); `1 >= 3` is `false`; `status = FAILED`; `retryDelays[1 - 1]` schedules **`2s`** (`lines 379-380`).
     - Failure #2: `retryCount` becomes `2`; `2 >= 3` is `false`; `status = FAILED`; `retryDelays[2 - 1]` schedules **`5s`**.
     - Failure #3: `retryCount` becomes `3`; `email.retryCount >= this.maxRetries` (`3 >= 3`) is **`true`** (`line 366`); `status = CANCELLED` (`line 367`).
   - **Result:** The **`15s` delay (`retryDelays[2]`) is never scheduled or enforced** in normal execution. Only 2s and 5s outer backoffs ever occur (with 3 inner attempts of `0s`, `+1s`, `+2s` each = up to 9 send attempts total).
   - **Timer-before-save drift:** `this.scheduleRetry(retryDelaySec)` (`line 380`) starts the `setTimeout` **before** `await this.emailLogRepo.save(email)` (`line 385`). When `save()` takes 50–300ms+ (e.g., Neon wake-up), `updatedAt` in DB is later than timer start; when the timer fires 2,000ms later, `secondsPassed` (`line 218`) is `< 2`, forcing an extra `scheduleRetry(1)` cycle (`lines 223-234`).

2. **Transient vs. Permanent Error Classification** — **CONFIRMED (DEFECT)**
   - **Inner loop retries permanent errors blindly (`lines 298-343`):** `isRetryableError(lastError)` is evaluated at `line 346` **after** the inner `while (attempt < 3)` loop has already executed 3 attempts and slept `1s + 2s = 3s` — even for permanent validation errors (`Recipient email address is invalid`) or SMTP `550` rejections.
   - **Error status masking in `EmailService` (`email.service.ts:177-185, 209-211`):**
     - `sendEmailViaApi()` assigns `(cleanError as any).status = 500` to **all** GAS errors and **all** dual-provider combined fallback errors (even if SMTP failed with `550` permanent rejection or GAS failed due to bad token/JSON).
     - Because `isRetryableError()` (`email-queue.service.ts:249-252`) returns `true` whenever `error?.status` is in `[429, 500, 502, 503, 504]`, permanent GAS errors and dual-fallback `550` errors are misclassified as transient and retried across all 3 outer runs (9 attempts).
   - For direct SMTP-only errors without GAS configured, `smtpError.responseCode` (e.g. `550`) is preserved (`email.service.ts:215`), so `isRetryableError` returns `false` and marks `CANCELLED` after the 3 inner attempts.

3. **Retry Timer Overlap & Dropped Timers** — **CONFIRMED (MATERIAL DEFECT)**
   - `scheduleRetry()` (`lines 112-121`) adds a new timer to `activeTimers` on every call without coalescing/deduplication. If 5 emails fail in `Promise.all`, up to 5 separate timers are queued.
   - **Timer loss while `isProcessing === true`:** If email `e1` in a batch fails at `T=3s` and calls `scheduleRetry(2)` (firing at `T=5s`) while email `e2` in the same `Promise.all` takes `6s` to finish, the `T=5s` timer fires while `isProcessing === true`, hits `if (this.isProcessing) return;` (`line 182`), and is **lost**. When `e2` completes at `T=6s`, `isProcessing` resets to `false` with no remaining timer for `e1`, leaving `e1` stranded in `FAILED` for up to **30 minutes**.
   - Across multiple instances, timers are strictly process-local; retry waves from two instances can collide and race on `claimResult` (or `catch` fallback).

4. **Batch Quota (5 Emails per 12 Seconds) & Continuation** — **CONFIRMED (DEFECT)**
   - Code comments (`lines 125, 236`) refer to *"5 emails per minute"*, whereas `scheduleBatchContinuation(12000)` (`lines 127, 242`) uses 12,000ms (5 emails per 12s = 25/min).
   - **Does NOT enforce the 5-email-per-12s quota:**
     1. Timer starts at batch **start** (`line 242`), not batch completion, and `processEmailQueue()` maintains no `lastBatchTimestamp` cooldown. A batch finishing in 0.5s allows a new `@OnEvent('email.logs.updated')` call at 0.6s to immediately send 5 more emails (10 emails in < 1 second).
     2. If a batch takes `> 12s` (e.g., 3 inner retries + slow network), `scheduleBatchContinuation(12000)` fires while `isProcessing === true`, hits `line 182`, and is **dropped** — stranding the backlog until the 30-minute cron!
     3. With $N$ concurrent instances, each instance independently sends up to 5 emails per run ($5 \times N$ cluster burst).
     4. `take: 100` (`line 200`) fetches the oldest 100 `PENDING`/`FAILED` rows; > 100 `FAILED` rows in backoff could block newer `PENDING` rows from being seen in that query.

5. **30-Minute Cron Fallback & Event-Driven Dispatch** — **CONFIRMED WITH CAVEATS**
   - `@Cron(process.env.EMAIL_QUEUE_CRON || CronExpression.EVERY_30_MINUTES)` (`line 169`) and `@OnEvent('email.logs.updated')` (`line 170`) both invoke `processEmailQueue()` (`ScheduleModule.forRoot()` and `EventEmitterModule.forRoot()` are registered in `app.module.ts:78-79`).
   - **Caveat 1 (`EMAIL_QUEUE_CRON` load order):** `process.env.EMAIL_QUEUE_CRON` is evaluated when the `@Cron(...)` class decorator runs at module import time — **before** `ConfigModule.forRoot()` loads `.env` files (`app.module.ts:35-42`). It works when injected by Render/OS environment variables, but is ignored if defined only in `.env`.
   - **Caveat 2 (Missing event emission in `EmailMonitoringService`):** [`EmailMonitoringService.resend()` and `retry()`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email-monitoring/email-monitoring.service.ts#L283-L329) set `status = PENDING` without emitting `'email.logs.updated'`, so single-email admin retries wait up to 30 minutes (only `retryAllFailed()` at `line 384` emits the event).
   - **Caveat 3 (Event drop during `isProcessing === true`):** Documented in Section 5 #5.

---

## 8. Startup and Shutdown Analysis

### Startup Sequence (`onModuleInit()`)
1. **Execution Order (`email-queue.service.ts:34-53`):**
   1. `recoverStuckProcessingEmails()` (`line 37`)
   2. `recoverGasQuotaExceededEmails()` (`line 43`) — emits `'email.logs.updated'` at `line 104`
   3. `processEmailQueue()` (`line 49`)
   Wrapped in `try/catch` (`lines 35-52`).
2. **NestJS Lifecycle Findings (Verified in `node_modules/@nestjs/core` & `@nestjs/event-emitter`):**
   - **Concurrent module init (`on-module-init.hook.js`):** NestJS invokes `onModuleInit()` across all non-transient providers in `EmailModule` (`EmailService`, `EmailQueueService`, `GmailSmtpService`) concurrently via `Promise.all`. `EmailQueueService.onModuleInit()` does not wait for `GmailSmtpService.onModuleInit()`'s `await this.transporter.verify()` (`gmail-smtp.service.ts:56`), though `scriptUrl`, `secretToken`, and `transporter` are assigned synchronously before that `await`.
   - **Event listener not yet mounted:** `EventSubscribersLoader.onApplicationBootstrap()` attaches `@OnEvent` listeners *after* `onModuleInit()` finishes. The `'email.logs.updated'` emitted inside `recoverGasQuotaExceededEmails()` (`line 104`) has no listeners yet, though `line 49` mitigates this by calling `processEmailQueue()` directly — *unless* `recoverStuckProcessingEmails()` throws (e.g., enum error), in which case `try/catch` catches at `line 50` and skips both quota recovery and startup flush.
   - **Startup blocking risk (`main.ts:82`):** `await this.processEmailQueue()` inside `onModuleInit()` blocks `await app.listen(port)`. If 5 pending emails hang on external GAS/SMTP endpoints at boot, HTTP `/api/health/live` will not respond until they finish or fail, risking platform deployment health-check timeouts.

### Shutdown Sequence (`beforeApplicationShutdown()`)
1. **Execution Order (Verified in `node_modules/@nestjs/core/nest-application-context.js` & `@nestjs/typeorm/dist/typeorm-core.module.js`):**
   When `SIGTERM`/`SIGINT` arrives (with `app.enableShutdownHooks()` at `main.ts:16`):
   1. `callDestroyHook()` -> `onModuleDestroy()` (`PerformanceService`)
   2. `callBeforeShutdownHook(signal)` -> `EmailQueueService.beforeApplicationShutdown()` (`lines 145-162`) and `NotificationRetryCron.beforeApplicationShutdown()` (`notification-retry.cron.ts:19-32`, also up to 10s)
   3. `dispose()` -> closes Socket.IO and HTTP server (`httpAdapter.close()`)
   4. `callShutdownHook(signal)` -> `TypeOrmCoreModule.onApplicationShutdown()` calls `await dataSource.destroy()` (closes PostgreSQL pool); `SchedulerOrchestrator.onApplicationShutdown()` closes cron jobs; `EventSubscribersLoader.onApplicationShutdown()` removes listeners.
2. **Timer Cleanup (`lines 138-143, 150`):**
   - `this.isShuttingDown = true` (`line 147`) prevents `scheduleRetry()` / `scheduleBatchContinuation()` from registering new timers, and `clearScheduledTimers()` clears all `NodeJS.Timeout` handles in `this.activeTimers`.
   - *Note:* The inner retry loop's `setTimeout(resolve, delay)` (`line 339`) is **not** tracked in `activeTimers` and is **not** cancelled on shutdown.
3. **In-Flight Gmail Requests on `SIGTERM` — CONFIRMED (NOT CANCELLED)**
   - **Within 10s drain window:** If `sendEmailViaApi()` finishes in `< 10s`, `beforeApplicationShutdown()` waits (`lines 154-160`), and `save(email)` (`line 385`) writes `SENT`/`FAILED`/`CANCELLED` before `TypeOrmCoreModule.onApplicationShutdown()` destroys the DB pool. (Note: `httpAdapter.close()` has not run yet during step 2, so incoming requests can still enqueue new `PENDING` rows during the drain, though `processEmailQueue()` skips them due to `isShuttingDown = true`.)
   - **Exceeding 10s drain window — MATERIAL DEFECT:**
     - `EmailQueueService` passes **no `AbortSignal` / `AbortController`** to `EmailService` or `GmailSmtpService`.
     - `GmailSmtpService.sendMailViaGas()` calls `fetch()` with **no `AbortController` and no timeout** (`gmail-smtp.service.ts:120-126`). Nodemailer has **no `socketTimeout`** (`gmail-smtp.service.ts:43-53`).
     - The inner retry loop (`email-queue.service.ts:298-343`) does **not** check `this.isShuttingDown` before starting attempt 2 or 3.
     - Clearing `activeTimers` does **NOT** cancel an active HTTP `fetch()` or SMTP socket!
     - After 10,000ms (`line 156`), `beforeApplicationShutdown()` logs `'Email queue drain timed out after 10s, forcing shutdown.'` (`line 157`), breaks, and immediately logs `'Email queue drained successfully.'` (`line 161` — misleading log!).
     - NestJS immediately proceeds to `TypeOrmCoreModule.onApplicationShutdown()` and calls **`await dataSource.destroy()`**, closing the PostgreSQL pool **while the in-flight Gmail HTTP/SMTP request is still running**.
     - If Gmail subsequently accepts the email, `await this.emailLogRepo.save(email)` (`line 385`) fails because the `DataSource` is closed (or the container receives `SIGKILL`), leaving the email in **`PROCESSING`** even though it was sent!
4. **How Another Instance Handles Leftover `PROCESSING` Jobs** — **CONFIRMED (GAP)**
   - Already-running instances **ignore** `PROCESSING` rows completely (`line 194` only selects `PENDING` and `FAILED`).
   - Only a booting instance (`onModuleInit()`) checks `PROCESSING` rows, and only resets them if `updatedAt < Date.now() - 10 minutes`. If a container restarts within 10 minutes of claiming the job, the job remains stranded in `PROCESSING` indefinitely.

---

## 9. Test Coverage and Actual Test Execution Results

### Observed Jest Execution (Executed Directly During Audit)

Working directory: `ecr-system`

1. **Command:** `npx jest src/email/services/email-queue.service.spec.ts --verbose`
   - **Outcome:** **PASS** — `1 passed, 1 total` suite; **`13 passed, 13 total`** tests; `0` snapshots; Time: `14.852 s` (suite `14.441 s`).
2. **Command:** `npx jest src/email --verbose`
   - **Outcome:** **PASS** — `7 passed, 7 total` suites; **`80 passed, 80 total`** tests; `0` snapshots; Time: `37.583 s`.
   - Exact suite breakdown observed in output (note: Jest path regex `src/email` matches both `src/email/` and `src/email-monitoring/`):
     - `src/email/services/email-queue.service.spec.ts`: **13 passed**
     - `src/email/services/email-template.service.spec.ts`: **8 passed**
     - `src/email/services/gmail-smtp.service.spec.ts`: **10 passed**
     - `src/email/email.controller.spec.ts`: **10 passed**
     - `src/email/services/email.service.spec.ts`: **16 passed**
     - `src/email-monitoring/email-monitoring.controller.spec.ts`: **10 passed**
     - `src/email-monitoring/email-monitoring.service.spec.ts`: **13 passed**
   - *(Correction to prior documentation: `PHASE-8-ECR-FINAL-AUDIT-REPORT.md:194-195` reported `gmail-smtp.service.spec.ts: 16 passed` and `email-sender.service.spec.ts: 10 passed`; in the actual repository `gmail-smtp.service.spec.ts` has 10 tests and `email-sender.service.spec.ts` does not exist.)*

> **CRITICAL LIMITATION ON MOCKED TESTS:** All 13 tests in `email-queue.service.spec.ts` mock `emailLogRepo` (including `mockQueryBuilder`), `emailService.sendEmailViaApi`, `configService`, `eventEmitter`, `monitoringService`, and `performanceService`. **These unit tests DO NOT connect to PostgreSQL/Neon, DO NOT execute SQL, DO NOT validate TypeORM enum compatibility (`PROCESSING`), and DO NOT prove real multi-instance PostgreSQL concurrency, row-level locking, or crash/network behavior.**

### Checklist Coverage Matrix

| Audit Scenario | Coverage Status | Exact Evidence / Gaps in `email-queue.service.spec.ts` |
| :--- | :--- | :--- |
| Atomic claiming | **Mocked / Superficial** (`lines 163-178`) | Only stubs `mockQueryBuilder.execute.mockResolvedValueOnce({ affected: 0 })`. Does **not** assert `.update(EmailLog)`, `.set(...)`, `.where(...)` SQL/arguments, `catch` fallback bypass (`lines 284-288`), or real PostgreSQL row locking. |
| Two concurrent workers | **NOT COVERED** | No test invokes two `processEmailQueue()` calls concurrently (neither single-instance `isProcessing` overlap nor two worker instances). |
| Multiple application instances | **NOT COVERED** | No multi-instance race tests (recovery vs. active send, concurrent `onModuleInit()`, or multi-instance quota burst). |
| Stale `PROCESSING` recovery | **Mocked / Superficial** (`lines 212-231`) | Stubs `mockQueryBuilder.getMany` directly. Never verifies the `where`/`andWhere` predicate, 10-minute cutoff calculation, non-stale `PROCESSING` preservation, or conditional SQL update. |
| Recovery while another instance is sending | **NOT COVERED** | Zero coverage of TOCTOU race between `getMany()` and `save()`, or slow send > 10m. |
| Gmail success followed by application crash | **NOT COVERED** | Zero coverage of crash/reject between `sendEmailViaApi()` and `emailLogRepo.save()`. |
| Retry scheduling | **Partial** (`lines 107-142`) | Only verifies `retryCount: 0 -> 1` calling `scheduleRetry(2)`. Does not test `5s`, does not detect dead `15s` delay, does not test `minRetryDelayNeeded`, does not test `isRetryableError` transient vs. permanent distinction, and does not test retry timer dropped while `isProcessing === true`. |
| Batch quota and continuation | **Partial** (`lines 144-161`) | Verifies slicing 8 items to 5 and spying `scheduleBatchContinuation(12000)`. Never executes the continuation timer, never tests event-driven bypass of 12s window, and never tests continuation dropped when batch > 12s. |
| Startup behavior | **Mocked / Superficial** (`lines 233-245`) | Spies out all three methods (`recoverStuckProcessingEmails`, `recoverGasQuotaExceededEmails`, `processEmailQueue`) with no-op mocks; does not verify call order, error handling, or `GmailSmtpService` init race. |
| Shutdown while an email is in flight | **NOT COVERED** | `beforeApplicationShutdown` test (`lines 181-192`) hardcodes `(service as any).isProcessing = false` (`line 183`). Never tests active `isProcessing === true`, the 10s drain timeout, or uncancelled `fetch`/SMTP requests. |

---

## 10. Confirmed Defects

| ID | Classification | Location | Description |
| :--- | :--- | :--- | :--- |
| **D-01** | **CONFIRMED** | [`email-queue.service.ts:58-77`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L58-L77) | **Non-atomic stuck-job recovery (`getMany` + `save`):** `recoverStuckProcessingEmails()` reads stale rows and calls unconditional `save()`, creating TOCTOU races that can revert `SENT` or freshly claimed `PROCESSING` jobs back to `PENDING` during concurrent startups or slow sends. |
| **D-02** | **CONFIRMED** | [`email-queue.service.ts:37, 58, 194`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L37) | **Startup-only recovery strands `PROCESSING` jobs permanently on <10m restarts or single-node crashes:** `recoverStuckProcessingEmails()` is never called periodically (e.g., by the 30-minute cron). A crashed/timed-out job < 10 minutes old at restart is skipped and stays `PROCESSING` indefinitely. Also `stuckThresholdMs` is not env-configurable and recovery does not increment `retryCount`. |
| **D-03** | **CONFIRMED** | [`email-queue.service.ts:269-288`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L269-L288) | **Atomic claim `catch` fallback silently breaks distributed locking:** Any database error during the conditional `UPDATE` is swallowed without logging and falls back to unconditional `emailLogRepo.save(email)` (only intended for unit-test mocks), bypassing `WHERE status IN ('PENDING', 'FAILED')`. |
| **D-04** | **CONFIRMED** | [`email-queue.service.ts:194, 385`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L385) | **Unconditional final `save(email)` overwrites concurrent state:** Post-send persistence updates by primary key `id` with the stale pre-claim JS object, without `WHERE status = 'PROCESSING'`, risking overwriting admin `CANCELLED`/`PENDING` changes or reclaimed jobs. |
| **D-05** | **CONFIRMED** | [`1783487119085-PostgresMigration.ts:39-40`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/migrations/1783487119085-PostgresMigration.ts#L39-L40), [`email-log.entity.ts:44-49`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/entities/email-log.entity.ts#L44-L49), [`app.module.ts:93`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/app.module.ts#L93) | **Schema/migration missing `'PROCESSING'` in `email_logs_status_enum`:** `PostgresDriver` maps `simple-enum` to native PostgreSQL `ENUM`, yet migrations only define `('PENDING', 'SENT', 'FAILED', 'CANCELLED')` and no migration or startup `ALTER TYPE` adds `'PROCESSING'` (nor `providerMessageId` / `'PasswordReset'`). On a migration-built DB with `synchronize: false`, recovery crashes and `onModuleInit()` silently skips startup flush. |
| **D-06** | **CONFIRMED** | [`email-queue.service.ts:182-185, 242, 380, 400`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L182-L185) | **`isProcessing` guard drops overlapping events, retry timers, and batch continuations:** Any `'email.logs.updated'` event, `scheduleRetry()` timer, or `scheduleBatchContinuation(12000)` timer firing while `isProcessing === true` returns immediately without setting a dirty/rescan flag, stalling emails up to 30 minutes. |
| **D-07** | **CONFIRMED** | [`email-queue.service.ts:31, 211, 219, 366, 379-385`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L211) | **`15s` retry delay is unreachable dead code & timer/DB timestamp drift:** `maxRetries = 3` cancels at `retryCount === 3` (`line 366`), so index `2` (`15s`) of `[2, 5, 15]` is never used. Scheduling `setTimeout` (`line 380`) before `save()` (`line 385`) also causes early timer wakeup and extra 1s re-schedule cycles. |
| **D-08** | **CONFIRMED** | [`email-queue.service.ts:298-343, 346`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L298-L343), [`email.service.ts:177-185, 209-211`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email.service.ts#L177-L185) | **Permanent errors retried unnecessarily & status masking:** Inner loop sleeps `1s + 2s` across 3 attempts before checking `isRetryableError()`. `EmailService` forces `status = 500` on all GAS and dual-fallback errors, turning permanent failures into retryable 3x3 attempts. |
| **D-09** | **CONFIRMED** | [`email-queue.service.ts:145-162, 298-343`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L145-L162), [`gmail-smtp.service.ts:43-53, 120-126`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/gmail-smtp.service.ts#L120-L126) | **Unsafe shutdown for >10s in-flight sends:** No `AbortController` or HTTP/socket timeout exists on GAS `fetch()` or SMTP; inner retry loop ignores `isShuttingDown`; after 10s timeout `beforeApplicationShutdown()` logs `'Email queue drained successfully.'` (`line 161`), and `TypeOrmCoreModule.onApplicationShutdown()` closes the DB pool while Gmail requests may still be running. |
| **D-10** | **CONFIRMED** | [`email-queue.service.ts:237, 241-243`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L237-L243) | **5-email-per-12s quota not enforced across events or instances:** Continuation timer starts at batch start instead of completion, no cooldown timestamp prevents rapid `@OnEvent` bursts, and multiple instances run uncoordinated $5 \times N$ bursts. |
| **D-11** | **CONFIRMED** | [`email-queue.service.ts:59, 273`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L59), [`1783487119085-PostgresMigration.ts:40`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/migrations/1783487119085-PostgresMigration.ts#L40) | **Timestamp clock/timezone inconsistency:** `cutoff` and `updatedAt` use Node.js `Date.now()`/`new Date()` against a PostgreSQL `TIMESTAMP WITHOUT TIME ZONE` column (`DEFAULT now()`), introducing timezone/clock-skew sensitivity across hosts and DB defaults. |
| **D-12** | **CONFIRMED** | [`email-queue.service.ts:79-106`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L79-L106) | **`recoverGasQuotaExceededEmails()` over-matches & is non-atomic:** Matches `'%Google Apps Script error%'` (every GAS error, not just quota) and resets `CANCELLED` rows non-atomically via `getMany()` + `save()` on every restart. |
| **D-13** | **CONFIRMED** | [`email-monitoring.service.ts:283-329`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email-monitoring/email-monitoring.service.ts#L283-L329) | **Admin single-email `resend()` / `retry()` missing event emit:** Neither emits `'email.logs.updated'`, causing up to 30-minute dispatch latency. |
| **D-14** | **CONFIRMED** | [`email-queue.service.ts:49, 169`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L49), [`main.ts:82`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/main.ts#L82) | **Startup queue flush blocks HTTP listen & `@Cron` ignores `.env` files:** `await this.processEmailQueue()` in `onModuleInit()` delays `app.listen(port)` on slow/hanging email sends; `process.env.EMAIL_QUEUE_CRON` in the `@Cron` decorator is read before `ConfigModule.forRoot()` parses `.env`. |

---

## 11. Potential Risks That Need Further Testing

The following items are **NOT VERIFIED** in this read-only source audit and require live PostgreSQL/Neon + multi-process testing:

1. **Live Neon Schema State (`NOT VERIFIED`):** Verify via read-only catalog inspection on Neon whether `email_logs.status` is currently a native PostgreSQL enum `email_logs_status_enum` (and whether `'PROCESSING'` was added out-of-band) or `varchar`, and whether `providerMessageId` and `'PasswordReset'` exist in Neon.
2. **Real PostgreSQL Concurrent Worker Contention (`NOT VERIFIED`):** Test two live NestJS backend processes hitting the same Neon/PostgreSQL database simultaneously with real `PENDING`/`FAILED` rows, validating row-level lock contention, `UpdateResult.affected`, and query plans on `@Index(['status', 'createdAt'])`.
3. **Host/DB Timezone Alignment on Render & Neon (`NOT VERIFIED`):** Verify `TZ` environment setting on Render containers vs. Neon session `TimeZone` so `TIMESTAMP WITHOUT TIME ZONE` comparisons do not drift by `+05:30` or other offsets.
4. **Real `fetch()` / Nodemailer Hang Behavior Under `SIGTERM` (`NOT VERIFIED`):** Measure actual Render `SIGTERM` -> `SIGKILL` grace window against hanging GAS HTTP requests and SMTP sockets without timeouts.
5. **Startup Blocking Under Queued Backlog (`NOT VERIFIED`):** Test Render deploy health-check startup latency when `email_logs` contains 5+ failing/hanging emails at boot while `onModuleInit()` awaits `processEmailQueue()`.

---

## 12. Recommended Corrections (Not Implemented)

All items below are classified as **RECOMMENDATION** (do not implement during Task 1):

1. **RECOMMENDATION — Make `recoverStuckProcessingEmails()` Atomic & Periodic:**
   - Replace `getMany()` + `save()` with a single conditional SQL `UPDATE` using database clock (`NOW() - (:thresholdMs * interval '1 millisecond')`):
     `UPDATE email_logs SET status = 'PENDING', "retryCount" = "retryCount" + 1, "failureReason" = ... WHERE status = 'PROCESSING' AND "updatedAt" < NOW() - ...` (capping at `maxRetries` -> `CANCELLED` to prevent poison-pill loops).
   - Also run stuck-job recovery periodically (e.g., inside the 30-minute fallback cron or on a safe condition) rather than only in `onModuleInit()`, and read `STUCK_EMAIL_THRESHOLD_MS` via `ConfigService`.
   - Apply the same atomic `UPDATE` pattern to `recoverGasQuotaExceededEmails()` and narrow `msg2` so non-quota GAS errors are not unconditionally revived on every boot.

2. **RECOMMENDATION — Remove the `catch` Fallback Bypass & Guard Post-Send Persistence:**
   - Remove the `catch` fallback to `emailLogRepo.save(email)` (`lines 284-288`); log and fail/skip safely instead of bypassing atomic locking. Update unit test mocks to support `createQueryBuilder().update()` cleanly.
   - Replace unconditional `this.emailLogRepo.save(email)` (`line 385`) with a conditional `UPDATE ... WHERE id = :id AND status = 'PROCESSING'` (also persisting `providerMessageId` returned by `sendEmailViaApi()`).
   - Optionally use `SELECT ... FOR UPDATE SKIP LOCKED` inside a short claim transaction or `UPDATE ... RETURNING *` CTE so claimed fields (`retryCount`, `updatedAt`) are fresh.

3. **RECOMMENDATION — Fix PostgreSQL Enum Migration & Timestamp Types:**
   - Add an idempotent non-transactional TypeORM migration (`transactional = false`) adding `'PROCESSING'` to `email_logs_status_enum` (and `'PasswordReset'` to `email_logs_event_enum`, plus `"providerMessageId"` if missing from migrations), or standardize on `varchar`/`TIMESTAMPTZ` across migrations and entities.
   - Use PostgreSQL `NOW()` consistently for `updatedAt` and stale-cutoff comparisons (or `TIMESTAMPTZ` + UTC).

4. **RECOMMENDATION — Fix `isProcessing` Dropped Events/Timers & Batch Rate Limiting:**
   - Track a `pendingRescan = false` flag when `processEmailQueue()` is called while `this.isProcessing === true`, and loop/re-check in `finally` (or after current batch) if `pendingRescan` was set — or track explicit next-due timestamps so backoff/continuation timers are coalesced and never lost.
   - Measure the 12-second batch cooldown from batch completion (persisting/tracking `lastBatchCompletedAt` locally or via a DB lease/next-attempt timestamp for multi-instance rate limiting).

5. **RECOMMENDATION — Align Retry Schedule, Error Classification & Shutdown Cancellation:**
   - Either align `retryDelays` and `maxRetries` (e.g., `maxRetries = 4` if `[2, 5, 15]` are all intended outer backoffs, or document `[2, 5]`) and schedule `setTimeout` **after** `save()` completes using the saved `updatedAt`.
   - Check `isRetryableError` inside the inner retry loop so permanent errors fail fast without 3s of wasted sleeps, and preserve original HTTP/SMTP error codes instead of overwriting `.status = 500` in `EmailService.sendEmailViaApi()`.
   - Add an `AbortController` + explicit timeout (e.g., 8–10s) to `GmailSmtpService.sendMailViaGas()` `fetch()`, set Nodemailer `socketTimeout`, abort in-flight requests and check `isShuttingDown` between inner attempts on `beforeApplicationShutdown()`, and only log `'Email queue drained successfully.'` when `isProcessing === false`.
   - Avoid blocking `app.listen()` in `onModuleInit()` with long network sends (e.g., run startup recovery DB updates synchronously/fast, then trigger `processEmailQueue()` non-blockingly after bootstrap), emit `'email.logs.updated'` in `EmailMonitoringService.resend()`/`retry()`, and add real PostgreSQL integration tests covering multi-instance claims, recovery races, and shutdown timeouts.

---

## 13. Final Verdict

### **VERDICT: FAIL**

**Basis:** While the Phase 6 change achieves its primary Neon goal of relaxing idle polling from 1 minute to 30 minutes and introduces a query-builder claim update for `PENDING`/`FAILED` rows, **multiple confirmed material defects** violate concurrency, recovery, retry, schema, and shutdown safety requirements:
* Non-atomic `recoverStuckProcessingEmails()` (`getMany` + `save`) can overwrite active `PROCESSING` or completed `SENT` rows.
* Startup-only recovery leaves crashed/timed-out `PROCESSING` jobs permanently stranded across `< 10 minute` restarts.
* Silent `catch` fallback bypasses atomic locking, and unconditional final `save()` can overwrite concurrent state.
* Migration `email_logs_status_enum` lacks `'PROCESSING'`.
* `isProcessing` silently drops overlapping `'email.logs.updated'` events, retry timers, and batch continuations (causing up to 30-minute stalls).
* Delivery semantics are **at-least-once** (not **exactly-once**), `15s` retry backoff is unreachable dead code, and `SIGTERM` shutdown does not abort active Gmail HTTP/SMTP requests before `TypeOrmCoreModule` destroys the database connection pool.
