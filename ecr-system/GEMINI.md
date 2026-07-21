# ♊ Backend Instructions: NestJS (`/ecr-system`)

This file contains backend-specific coding patterns, standards, and database transaction strategies for the **NestJS API**.

---

## 🗄️ Database Concurrency & Query Locking Rules

To maintain absolute data integrity and prevent double-spending or race conditions during report updates, adhere to these strict TypeORM locking rules:

### 1. Pessimistic Write Lock (`pessimistic_write`)
Any service mutating a report or creating an associated sub-entity (such as an Inspection, Review, Approval, or Component Issue) must secure a write lock on the main `DefectReport` row. This prevents parallel operations from editing the report at the same time.

### 2. Mandatory `relationLoadStrategy` Setup
PostgreSQL cannot apply `FOR UPDATE` locks on tables that are outer-joined via nullable relations.
*   **Rule:** When fetching a report with a pessimistic write lock and its relations, always set `relationLoadStrategy: 'query'`.
*   **Code Template:**
    ```typescript
    const report = await this.defectReportsRepository.findOne({
      where: { id: reportId },
      relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval', 'componentIssues'],
      relationLoadStrategy: 'query', // Crucial for Postgres compatibility
      lock: { mode: 'pessimistic_write' },
    });
    ```

---

## 🛰️ Event-Driven Architecture (Decoupling)

To maintain high responsiveness and prevent HTTP timeouts:
1.  **Transactional Integrity**: Never perform external HTTP requests (e.g., email SMTP, Cloudinary uploads) within database transactions.
2.  **Event Bus**: Emit events using NestJS `@nestjs/event-emitter`.
    ```typescript
    this.eventEmitter.emit('report.status.changed', new ReportStatusChangedEvent(report));
    ```
3.  **Subscribers**: Create listeners to handle notifications or deductions asynchronously.
    ```typescript
    @OnEvent('report.status.changed')
    async handleStatusChanged(event: ReportStatusChangedEvent) {
      // Logic for background processing
    }
    ```

---

## 📊 Structured Logging & Observability

Maintain unified logs to ease production debugging. Include specific tags at the beginning of log messages:
*   `[EMAIL_DIAGNOSTICS]`: Logging SMTP proxy flows, queue retries, and failures.
*   `[SALARY_DEDUCTION_WARN]`: Warning about miscalculated operators or rate mismatch issues.
*   `[TRANSACTION_ALERT]`: Logging transactions taking longer than 1500ms.

---

## 🧪 Testing and Verification Guidelines

Before submitting any code changes, run the testing suites:
*   **Run Jest unit tests**:
    ```bash
    npm run test
    # or
    npx jest
    ```
*   **Design Test Assertions**: Ensure that any new service method has corresponding `.spec.ts` coverage verifying:
    *   Happy paths with correct entity outcomes.
    *   Validation exceptions (e.g., incorrect role attempting status transition).
    *   Rollback safety on transaction failures.
