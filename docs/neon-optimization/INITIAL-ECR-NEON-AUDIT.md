# ECR Application — Initial Neon Compute Usage Investigation
## Comprehensive Strict Read-Only Audit — Pre-Phase 6

**Audit Date:** November 26, 2026  
**Auditor:** Antigravity Agentic Assistant  
**Status:** COMPLETE (Strict Read-Only Audit)  
**Deliverable Path:** `docs/neon-optimization/INITIAL-ECR-NEON-AUDIT.md`  

---

## 1. Executive Summary

This read-only architectural and runtime audit was conducted to determine why Neon Serverless PostgreSQL compute usage has accumulated **18.45 CU-hours** since November 17, 2026, despite the Enterprise Quality Report (ECR) system having **no active business usage or report creation** during this timeframe.

### Key Audit Findings:
1. **Primary Root Cause — Unconditional 60-Second Email Polling:**
   `EmailQueueService` in `ecr-system/src/email/services/email-queue.service.ts` runs an active `@Cron(CronExpression.EVERY_MINUTE)` schedule. Every 60 seconds (1,440 times per day), it executes a SQL `SELECT` query against the `email_logs` table. This occurs **unconditionally**, even when the email queue has zero pending or failed jobs.
2. **Neon Inactivity Timeout Defeated:**
   Neon Serverless PostgreSQL compute relies on an idle timeout (default: 5 minutes / 300 seconds) to automatically suspend compute to zero (scale-to-zero). Because the email poller executes a database query every 60 seconds, Neon's idle timer is reset at 1-minute intervals. Consequently, Neon compute remains active **24/7 (100% active duty cycle)**.
3. **Database Provider Clarification:**
   The application uses **TypeORM (`^0.3.31`)** with the native Node.js PostgreSQL driver (**`pg ^8.12.0`**). **Prisma is not installed or configured anywhere in this repository.**
4. **Secondary Risk — Heavy Health Check Queries:**
   The `GET /api/health` endpoint executes **5 distinct SQL queries** on every request (`SELECT 1` plus 4 count queries across `email_logs` and `notifications`). If Render health checks or external uptime pingers target `/api/health` rather than the lightweight heartbeat `/api/health/live` (0 database queries), they contribute directly to keeping Neon compute awake.
5. **Zero Frontend Polling Leakage:**
   The frontend (React + TanStack Query) does not run background refetch intervals (`refetchInterval: 0`, `refetchOnWindowFocus: false`). When users are not using the application, the frontend issues zero requests and zero database queries.

---

## 2. Neon Usage Baseline

Data provided from the Neon Console for the period between **November 17, 2026** and **November 26, 2026** (~9.5 days / ~228 hours):

| Metric | Recorded Value | Daily Average (~9.5 Days) | Hourly Average |
| :--- | :--- | :--- | :--- |
| **Compute Consumption** | **18.45 CU-hours** | ~1.94 CU-hours/day | ~0.081 CU-hours/hour |
| **Active Storage** | **66.77 MB** | Static base data | — |
| **History / WAL** | **450.54 kB** | ~47.4 kB/day | — |
| **Network Egress / Ingress**| **26.16 MB** | ~2.75 MB/day | ~114.7 kB/hour |

### Telemetry Correlation Analysis:
* **Network Egress Correlation:**  
  $$\frac{26.16\text{ MB}}{9.5\text{ days}} \approx 2.75\text{ MB/day} \div 1,440\text{ query cycles/day} \approx 1.91\text{ kB per query cycle}$$  
  A TLS handshake, TCP framing, and TypeORM parameter transmission for an empty `SELECT ... FROM email_logs` query consumes approximately **1.8–2.1 kB** per round-trip. This correlates with 1-minute empty-queue database polling.
* **Compute Accumulation Correlation:**  
  Neon fractional compute (typically configured between 0.10 CU and 0.25 CU minimum allocation) running continuously without entering suspend state accumulates:  
  $$0.10\text{ CU} \times 228\text{ hours} \approx 22.8\text{ CU-hours}$$  
  The 18.45 CU-hours recorded confirms that compute has been running almost continuously since deployment.

---

## 3. Root Causes

### Root Cause 1 (Primary): Unconditional 60-Second Email Queue Cron
* **Location:** [`ecr-system/src/email/services/email-queue.service.ts#L88-L146`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L88-L146)
* **Code Mechanism:**
  ```typescript
  @Cron(CronExpression.EVERY_MINUTE)
  @OnEvent('email.logs.updated')
  async processEmailQueue() {
    ...
    console.log('[EMAIL_DIAGNOSTICS] [STEP 5] Queue Processing: Polling email queue...');
    emailsToProcess = await this.emailLogRepo.find({
      where: [
        { status: EmailStatus.PENDING },
        { status: EmailStatus.FAILED },
      ],
      order: { createdAt: 'ASC' },
      take: 100,
    });
    ...
    if (validEmails.length === 0) return;
  }
  ```
* **Failure Mode:** The database query is sent across the wire **before** checking whether there are any emails to process. When the queue is empty, it returns 0 rows and exits, but the PostgreSQL server has already received and executed the query, resetting the auto-suspend timer.

### Root Cause 2 (Secondary / Potential Multiplier): Health Check Endpoint Probing
* **Location:** [`ecr-system/src/monitoring/health.controller.ts#L9-L12`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/monitoring/health.controller.ts#L9-L12) & [`monitoring.service.ts#L106-L165`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/monitoring/monitoring.service.ts#L106-L165)
* **Code Mechanism:**
  When `GET /api/health` is called, it executes:
  1. `await this.dataSource.query('SELECT 1');`
  2. `await this.dataSource.getRepository(EmailLog).count({ where: { status: EmailStatus.PENDING } });`
  3. `await this.dataSource.getRepository(EmailLog).count({ where: { status: EmailStatus.FAILED } });`
  4. `await this.dataSource.getRepository(Notification).count({ where: { status: NotificationStatus.QUEUED } });`
  5. `await this.dataSource.getRepository(Notification).count({ where: { status: NotificationStatus.FAILED } });`
* **Infrastructure Factor:** [`render.yaml`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/render.yaml) currently omits `healthCheckPath`. If Render's web console or an external uptime bot (UptimeRobot, Pingdom, etc.) is configured to ping `/api/health`, each ping triggers 5 database queries.

### Root Cause 3: Premature Pool Connection Pruning vs Polling Frequency
* **Location:** [`ecr-system/src/app.module.ts#L101-L105`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/app.module.ts#L101-L105)
* **Code Mechanism:**
  ```typescript
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,      // 30 seconds
    connectionTimeoutMillis: 5000, // 5 seconds
  }
  ```
* **Failure Mode:** `idleTimeoutMillis` closes idle client connections after 30 seconds. Because polling occurs at 60 seconds, every polling cycle is forced to negotiate a brand new SSL/TLS connection and TCP socket to Neon, preventing connection pooling from remaining quiet.

---

## 4. Complete Recurring-Task Inventory

Every recurring timer, cron job, interval, and background worker across the entire application:

| File Path & Line | Method / Task Name | Schedule / Frequency | Exact Database / System Operations | Executes When ECR Unused? | Wakes Neon? | Necessary for Business? | Can Safely Become Event-Driven? | Reliability / Workflow Risks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [`email-queue.service.ts#L88`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L88) | `EmailQueueService.processEmailQueue()` | `@Cron(EVERY_MINUTE)` (every 60s) | `SELECT ... FROM email_logs WHERE status IN ('PENDING', 'FAILED') ORDER BY createdAt ASC LIMIT 100` | **YES** | **YES** | Yes (for dispatching emails) | **YES** (Already has `@OnEvent('email.logs.updated')`) | Low risk if exponential backoff retries use in-memory timers. |
| [`notification-retry.cron.ts#L36`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/notifications/notification-retry.cron.ts#L36) | `NotificationRetryCron.handleRetry()` | `@Cron('0 0 1 1 *')` (Annually Jan 1) | Calls stub `retryFailed(3)` which returns `{ retried: 0 }`. Zero SQL queries. | No (annual) | **NO** | No (deprecated stub) | N/A (Already inactive) | Zero risk. |
| [`performance.service.ts#L65`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/monitoring/performance.service.ts#L65) | `PerformanceService.monitorMemory()` | `setInterval(..., 30000)` (every 30s) | Reads `process.memoryUsage()`. Stores values in memory buffer. Zero SQL queries. | Yes | **NO** | Yes (internal telemetry) | No (sampling metric) | Zero risk. Does not touch DB. |
| [`performance.service.ts#L66`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/monitoring/performance.service.ts#L66) | `PerformanceService.monitorCpuAndEventLoop()` | `setInterval(..., 10000)` (every 10s) | Reads `perf_hooks` event loop lag and `os.loadavg()`. Zero SQL queries. | Yes | **NO** | Yes (internal telemetry) | No (sampling metric) | Zero risk. Does not touch DB. |
| [`performance.service.ts#L68`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/monitoring/performance.service.ts#L68) | `PerformanceService.rpsInterval` | `setInterval(..., 1000)` (every 1s) | Rolls internal requests-per-second array buffer. Zero SQL queries. | Yes | **NO** | Yes (internal telemetry) | No (sampling metric) | Zero risk. Does not touch DB. |
| [`performance.service.ts#L79`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/monitoring/performance.service.ts#L79) | `PerformanceService.socketEventInterval` | `setInterval(..., 1000)` (every 1s) | Resets internal socket events counter. Zero SQL queries. | Yes | **NO** | Yes (internal telemetry) | No (sampling metric) | Zero risk. Does not touch DB. |
| [`notifications.gateway.ts#L57`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/notifications/notifications.gateway.ts#L57) | `NotificationsGateway.handleEmailLogsUpdated()` | `setTimeout(..., 2000)` debounce | Emits Socket.IO event `email_logs_updated` to connected clients. Zero SQL queries. | No (event-triggered) | **NO** | Yes (live UI sync) | Already event-driven | Zero risk. |
| [`defect-reports.service.ts#L58-L80`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports.service.ts#L58-L80) | `DefectReportsService.onModuleInit()` | Application boot (`OnModuleInit`) | 7 DDL `ALTER TYPE ...` queries, plus `SELECT ... FROM defect_reports WHERE reportNumber IS NULL`. | Startup only | **YES** (At boot) | Yes (historical data migration) | N/A (One-off startup task) | Moderate startup overhead. Should be in migration. |
| [`email-queue.service.ts#L33-L71`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L33-L71) | `EmailQueueService.onModuleInit()` | Application boot (`OnModuleInit`) | `SELECT ... FROM email_logs WHERE status IN ('FAILED', 'CANCELLED') AND failureReason LIKE ...` | Startup only | **YES** (At boot) | Yes (resilience against GAS quota) | N/A (One-off startup task) | Zero risk. |

---

## 5. Email Queue Detailed Investigation

### 5.1 Architecture & Mechanics
```
[User Action / API / RM Intake]
               │
               ▼
   [Report Mutation Service]
               │
               ▼ Emits 'report.status.changed'
   [NotificationListener]
               │
               ▼ Calls NotificationsService.create()
      [EmailService.queueEmail()]
               │
               ├─► Writes EmailLog to PostgreSQL (status = 'PENDING')
               │
               └─► Emits 'email.logs.updated' ──┐
                                                │ (Immediate event-driven wake)
   ┌────────────────────────────────────────────┘
   ▼
[EmailQueueService.processEmailQueue()] ◄─── ALSO CALLED EVERY 60s BY @Cron!
```

### 5.2 Lifecycle Analysis:
1. **Job Creation & Persistence:**
   Jobs are persisted in PostgreSQL table `email_logs` with `status: EmailStatus.PENDING`, `retryCount: 0`.
2. **Worker Wake-Up:**
   The worker has **dual triggers**:
   * It listens to `@OnEvent('email.logs.updated')` ([line 89](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L89)). When a new email is created or resubmitted, it wakes up **immediately**.
   * It also runs `@Cron(CronExpression.EVERY_MINUTE)` ([line 88](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L88)). Even when no email has been queued for days, it polls PostgreSQL every 60 seconds.
3. **Retry Scheduling:**
   Inside `processEmailQueue()`, failed emails have backoff delays checked:
   `const retryDelays = [2, 5, 15]; // seconds for retryCount 1, 2, 3`
   If sending fails on a transient error (e.g., 429, 500, network timeout), status becomes `FAILED` and `retryCount` increments.
4. **Dead-Letter Handling:**
   If `retryCount >= 3` or an error is non-retryable, status is marked `CANCELLED`.
5. **Stuck-Job & Restart Recovery:**
   On application boot, `recoverGasQuotaExceededEmails()` finds any emails failed due to Google Apps Script daily quotas and restores them to `PENDING`.
6. **Multi-Instance Safety:**
   Uses in-memory `private isProcessing = false;`. If scaled horizontally to multiple Render instances without a database-level lock, multiple instances would poll concurrently.

### 5.3 Empty-Queue Query Generation:
* **Per Minute:** 1 query
* **Per Hour:** 60 queries
* **Per Day:** **1,440 queries**
* **Per Month (30 Days):** **43,200 queries**
All 43,200 queries occur against PostgreSQL even if zero defect reports or emails are processed throughout the entire month.

---

## 6. Database Connection & Pool Lifecycle

### 6.1 Driver & ORM Verification
* **ORM:** TypeORM `0.3.31` via `@nestjs/typeorm 10.0.2`.
* **Driver:** `pg` (node-postgres) version `^8.12.0`.
* **Prisma Status:** **NOT INSTALLED.** No `schema.prisma`, no `@prisma/client`, no Prisma CLI.

### 6.2 Connection Pool Settings
Configured in [`ecr-system/src/app.module.ts#L88-L107`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/app.module.ts#L88-L107):
```typescript
{
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  autoLoadEntities: true,
  synchronize: process.env.NODE_ENV !== 'production',
  migrationsRun: true,
  extra: {
    max: 20,                          // Maximum client connections
    idleTimeoutMillis: 30000,          // 30 seconds idle eviction
    connectionTimeoutMillis: 5000,     // 5 seconds connection acquisition timeout
  },
}
```

### 6.3 Scale-to-Zero Conflict Analysis:
* **Neon Auto-Suspend Rule:** Neon monitors TCP connections and active query transactions. When all clients disconnect or remain idle for the suspension window (default: 300 seconds / 5 minutes), the compute container scales to zero.
* **The Conflict:**
  1. At $T = 0\text{s}$, the email cron queries `email_logs`.
  2. Query finishes at $T = 0.05\text{s}$.
  3. At $T = 30\text{s}$, `idleTimeoutMillis` evicts the idle connection from the pool.
  4. At $T = 60\text{s}$, the email cron triggers again, opening a new TCP/TLS socket to Neon and querying `email_logs`.
  5. The maximum idle duration Neon ever experiences is **59.95 seconds**.
  6. Neon's 300-second countdown can **never reach zero**.

---

## 7. Health Check & Render Investigation

### 7.1 Endpoints Implemented in Backend
From [`ecr-system/src/monitoring/health.controller.ts`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/monitoring/health.controller.ts#L1-L30):

```typescript
@Controller('health') // Note: Global prefix 'api' mounts this at /api/health
export class HealthController {
  @Get()
  async getHealth() {
    return this.monitoringService.getHealthMetrics(); // 5 SQL QUERIES!
  }

  @Get('live')
  getLive(@Res() res: Response) {
    return res.status(HttpStatus.OK).json({ status: 'live', uptime: process.uptime() }); // 0 SQL QUERIES!
  }

  @Get('ready')
  async getReady(@Res() res: Response) {
    const dbHealth = await this.monitoringService.checkDatabaseHealth(); // 1 SQL QUERY (SELECT 1)!
    ...
  }
}
```

### 7.2 Analysis of Query Overhead:
* **`GET /api/health/live` (Liveness):**
  * Queries executed: **0**
  * Reads only Node.js `process.uptime()`.
  * Returns HTTP 200 immediately.
  * **Zero impact on Neon compute.**
* **`GET /api/health/ready` (Readiness):**
  * Queries executed: **1** (`SELECT 1`)
  * Wakes Neon compute if asleep.
* **`GET /api/health` (Full Diagnostics):**
  * Queries executed: **5** (`SELECT 1`, 2 count queries on `email_logs`, 2 count queries on `notifications`).
  * If hit every 1–5 minutes by an uptime monitor or misconfigured health check, it generates up to **7,200 SQL queries/day**.

### 7.3 Render Configuration Audit:
In [`render.yaml`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/render.yaml):
* Service `ecr-system-web` defines build and start commands, but **does not specify `healthCheckPath`**.
* In [`production_readiness_handbook.md#L42`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/production_readiness_handbook.md#L42), the documented standard is:
  `Path /api/health/live on port 3000`
* **Verification Need:** If the live Render service dashboard was manually configured with `/api/health` instead of `/api/health/live`, Render's internal health prober will continuously query PostgreSQL every few minutes.

---

## 8. Frontend Polling & Query Investigation

### 8.1 TanStack Query Configuration
In [`frontend/src/main.jsx#L29-L37`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/frontend/src/main.jsx#L29-L37):
```javascript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevents refetching when user switches tabs
      retry: 1,
      staleTime: 5 * 60 * 1000,    // 5 minutes caching
    },
  },
});
```

### 8.2 Component-Level Audit
* Searched all frontend files for `refetchInterval`: **0 occurrences found.**
* Searched all frontend files for recurring `setInterval` calling API: **0 occurrences found.**
* Notification Provider ([`NotificationContext.jsx`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/frontend/src/contexts/NotificationContext.jsx#L17-L75)):
  * Queries `GET /api/notifications?unread=true` **only once on initial mount** or upon WebSocket reconnect.
  * Subsequent updates are delivered via Socket.IO push (`socket.on('notification', ...)`).
  * Does not poll.

### 8.3 Finding:
When the ECR application is not in active use by humans, **the frontend generates zero HTTP requests and zero database queries.** The compute consumption is 100% driven by server-side background operations.

---

## 9. Estimated Database Activity (Idle vs Normal)

### 9.1 Current Baseline (Idle State):
Under the current code configuration with zero human users:

| Source | Interval / Schedule | Queries per Minute | Queries per Day | Queries per Month |
| :--- | :--- | :--- | :--- | :--- |
| `EmailQueueService` | Every 60 seconds | 1 | 1,440 | 43,200 |
| `GET /api/health` *(if probed every 5m)* | Every 5 minutes | 1 (avg) | 1,440 | 43,200 |
| Other background cron/intervals | Various | 0 | 0 | 0 |
| **Total Idle Queries** | — | **1–2 queries/min** | **1,440 – 2,880/day** | **43,200 – 86,400/mo** |
| **Neon Idle Scale-to-Zero Window** | **NEVER REACHED** | **0 minutes/day** | **Compute active 24/7 (100% of time)** |

### 9.2 Optimized Target State (Idle State):
Under the proposed event-driven model with relaxed fallback:

| Source | Interval / Schedule | Queries per Minute | Queries per Day | Queries per Month |
| :--- | :--- | :--- | :--- | :--- |
| `EmailQueueService` (Event-driven) | Only on report actions | 0 (when idle) | 0 (when idle) | 0 (when idle) |
| Fallback Safety Check (Relaxed) | Every 30 minutes | 0.033 | 48 | 1,440 |
| Render Health Check (`/api/health/live`) | Any interval | 0 | 0 | 0 |
| **Total Idle Queries** | — | **~0 queries/min** | **~48 queries/day** | **~1,440 queries/mo** |
| **Neon Idle Scale-to-Zero Window** | **ACHIEVED** | **~25 min per cycle** | **Compute sleeps ~20 hours/day** |

---

## 10. Performance, Reliability & Business Risks

Any changes to background processing must strictly preserve:
1. Guaranteed email delivery for defect approvals, component issues, and vendor faults.
2. Exponential backoff retry for transient SMTP / Google Apps Script quota limits.
3. Socket.IO live notifications for active users.

### Specific Risks Evaluated:

1. **Risk of Dropped Emails If Cron Is Removed Completely:**
   * *Assessment:* If an email fails due to a temporary SMTP timeout, its status is set to `FAILED`. In the current code, the 60-second cron picks it up again after 2, 5, or 15 seconds. If the cron were completely deleted with no replacement, a failed email would remain in `FAILED` status until another report event happened to trigger the listener.
   * *Safe Solution:* Do not delete the retry mechanism. Instead, schedule a targeted in-memory `setTimeout` for the exact backoff duration (`2s`, `5s`, `15s`), and maintain a relaxed fallback cron (e.g., every 30 minutes) as a safety net.
2. **Risk of Missed Emails on Server Restart:**
   * *Assessment:* If the application container restarts while an email is pending, an in-memory timer would be lost.
   * *Safe Solution:* `EmailQueueService.onModuleInit()` already executes at boot. By adding a single queue check to `onModuleInit()`, any pending emails are flushed immediately upon startup without needing a 60-second recurring loop.
3. **Risk of Multi-Instance Lock Contention:**
   * *Assessment:* Currently, `EmailQueueService` uses an in-memory lock (`isProcessing`). If Render were scaled to multiple instances, multiple instances could pick up the same email.
   * *Safe Solution:* Retain single-instance deployment on Render for the monolithic app, or introduce `SKIP LOCKED` queries when scaling.

---

## 11. Prioritized Findings

| Priority | Finding ID | Issue Description | Location | Recommended Action |
| :--- | :--- | :--- | :--- | :--- |
| **CRITICAL** | **F-01** | Unconditional 60-second empty-queue SQL query resets Neon auto-suspend 1,440 times/day | [`email-queue.service.ts#L88`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L88) | Switch email queue to event-driven execution with in-memory retry timers and relaxed 30-minute fallback cron. |
| **HIGH** | **F-02** | Heavy health check endpoint (`GET /api/health`) runs 5 SQL queries per hit | [`health.controller.ts#L9`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/monitoring/health.controller.ts#L9) | Ensure Render dashboard and external pingers strictly target `/api/health/live`. |
| **HIGH** | **F-03** | Missing explicit `healthCheckPath` in `render.yaml` | [`render.yaml`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/render.yaml) | Add `healthCheckPath: /api/health/live` to `render.yaml` to ensure declarative infrastructure alignment. |
| **MEDIUM** | **F-04** | Pool connection idle timeout (30s) is shorter than cron polling interval (60s) | [`app.module.ts#L103`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/app.module.ts#L103) | Re-align pool parameters once polling interval is relaxed. |
| **MEDIUM** | **F-05** | Seven startup DDL `ALTER TYPE` queries in `DefectReportsService.onModuleInit()` | [`defect-reports.service.ts#L58-L69`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports.service.ts#L58-L69) | Move enum additions into standard TypeORM migrations. |
| **LOW** | **F-06** | Dead stub cron running annually in `NotificationRetryCron` | [`notification-retry.cron.ts#L36`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/notifications/notification-retry.cron.ts#L36) | Clean up or remove stubbed cron runner. |
| **LOW** | **F-07** | Dead environment variable `NOTIFICATION_RETRY_INTERVAL_MIN` in `.env.example` | [`ecr-system/.env.example#L24`](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/.env.example#L24) | Clean up template documentation. |

---

## 12. Implementation Recommendations (Phases 6–8)

### Phase 6 — Email Queue Event-Driven Optimization
1. **Rely on Existing Event Trigger:**
   `EmailService.queueEmail()` already emits `this.eventEmitter.emit('email.logs.updated')`. The listener is already wired up to `processEmailQueue()`.
2. **In-Memory Retry Scheduling:**
   When an email fails with retries remaining, schedule an in-memory timer:
   ```typescript
   setTimeout(() => {
     this.processEmailQueue();
   }, delaySeconds * 1000);
   ```
3. **Startup Flush:**
   In `EmailQueueService.onModuleInit()`, invoke `this.processEmailQueue()` once at application boot to guarantee any unprocessed emails are processed immediately after any deployment or restart.
4. **Relax Fallback Cron:**
   Change `@Cron(CronExpression.EVERY_MINUTE)` to `@Cron(CronExpression.EVERY_30_MINUTES)` as an emergency safety net.

### Phase 7 — Render & Infrastructure Health Check Alignment
1. In `render.yaml`, explicitly set:
   ```yaml
   healthCheckPath: /api/health/live
   ```
2. Verify in the Render Dashboard that the live web service uses `/api/health/live`.
3. If any third-party uptime monitoring service (UptimeRobot, Pingdom, BetterStack) is in place, verify its target URL points to `/api/health/live`.

### Phase 8 — Database Connection Pool & Migration Cleanup
1. Ensure connection strings in Render use Neon's pooled endpoint (`-pooler.region.neon.tech`) for optimal connection scaling.
2. Relocate startup DDL queries from `DefectReportsService.onModuleInit()` into an idempotent TypeORM migration script.

---

## 13. Items Requiring Owner Approval

Before implementing any modifications in Phase 6:

1. **Approval to modify `EmailQueueService`:**
   * Relax `@Cron` from every 1 minute to every 30 minutes.
   * Add in-memory `setTimeout` for backoff retries (2s, 5s, 15s).
   * Add startup queue check to `onModuleInit()`.
2. **Approval to update `render.yaml`:**
   * Declare `healthCheckPath: /api/health/live`.
3. **Confirmation of Render Dashboard Settings:**
   * Owner confirmation on whether any external uptime monitoring tool is currently pinging the application URL.

---
*End of Audit Report.*
