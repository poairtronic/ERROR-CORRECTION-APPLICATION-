# ECR Integration Audit: Velan Quality Hub & External Systems

This audit assesses the integration architecture, defect report data models, approval lifecycles, and machine-to-machine boundaries within the Velan Quality Hub (ECR Digitization System).

---

## 1. Intake Endpoints (RM / V-Smart Bridge)

ECR exposes three internal service-to-service routes in `InternalController` ([ecr-system/src/internal/internal.controller.ts#L18-L55](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.controller.ts#L18-L55)). Global prefix `/api` is configured in `main.ts#L79`.

| Route | HTTP Method | Guard / Auth | Controller Handler | Service Method |
| :--- | :--- | :--- | :--- | :--- |
| `/api/internal/rm-intake` | `POST` | `InternalSecretGuard` | `intakeFromRm` ([internal.controller.ts#L24-L42](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.controller.ts#L24-L42)) | `createFromRM` ([internal.service.ts#L40-L127](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.service.ts#L40-L127)) |
| `/api/internal/material-issued` | `POST` | `InternalSecretGuard` | `handleMaterialIssued` ([internal.controller.ts#L44-L49](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.controller.ts#L44-L49)) | `handleMaterialIssued` ([internal.service.ts#L129-L196](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.service.ts#L129-L196)) |
| `/api/internal/approved-reports` | `GET` | `InternalSecretGuard` | `getApprovedReports` ([internal.controller.ts#L50-L54](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.controller.ts#L50-L54)) | `getApprovedReportsForRm` ([internal.service.ts#L197-L214](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.service.ts#L197-L214)) |

### 1.1 Inbound Intake: `POST /api/internal/rm-intake`
*   **Guard / Auth:** `InternalSecretGuard` ([ecr-system/src/internal/guards/internal-secret.guard.ts#L4-L13](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/guards/internal-secret.guard.ts#L4-L13)). Checks header `x-internal-secret === process.env.ECR_INTERNAL_SECRET`. Throws `UnauthorizedException('Invalid or missing internal secret')` on mismatch.
*   **Validation:** NestJS `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` executing class-validator rules from `RmIntakeDto` ([ecr-system/src/internal/dto/rm-intake.dto.ts#L3-L78](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/dto/rm-intake.dto.ts#L3-L78)).

| Field | Type | Validation Decorators | Optional / Required | Description |
| :--- | :--- | :--- | :--- | :--- |
| `type` | `'REWORK' \| 'REJECTION'` | `@IsIn(['REWORK', 'REJECTION'])` | Required | Mode classification |
| `scNumber` | `string` | `@IsNotEmpty()`, `@IsString()` | Required | Subcontract job number |
| `poNumber` | `string` | `@IsNotEmpty()`, `@IsString()` | Required | Purchase order number |
| `component` | `string` | `@IsNotEmpty()`, `@IsString()` | Required | Component name |
| `quantityAffected` | `number` | `@IsInt()`, `@Min(1)` | Required | Affected integer count |
| `stageOfFailure` | `string` | `@IsOptional()`, `@IsString()` | Optional | Machining / assembly stage |
| `errorType` | `string` | `@IsOptional()`, `@IsString()` | Optional | Quality failure taxonomy |
| `defectDescription` | `string` | `@IsNotEmpty()`, `@IsString()` | Required | Defect narrative |
| `responsibleParty` | `string` | `@IsOptional()`, `@IsString()` | Optional | Fault attribution entity |
| `operatorName` | `string` | `@IsOptional()`, `@IsString()` | Optional | Machinist name (not persisted) |
| `reworkDescription` | `string` | `@IsOptional()`, `@IsString()` | Optional | Remediation instructions |
| `rejectionDescription` | `string` | `@IsOptional()`, `@IsString()` | Optional | Scrap narrative |
| `rejectionProcessTemplate` | `string` | `@IsOptional()`, `@IsString()` | Optional | Template flow key |
| `rejectionFailedStage` | `string` | `@IsOptional()`, `@IsString()` | Optional | Stage where part was scrapped |
| `rejectionStageCosts` | `Record<string, number>` | `@IsOptional()`, `@IsObject()` | Optional | Cost map per stage |
| `costEstimation` | `number` | `@IsOptional()`, `@IsNumber()` | Optional | Estimated remediation cost |
| `lossEstimation` | `number` | `@IsOptional()`, `@IsNumber()` | Optional | Financial loss amount |
| `alternativeNotes` | `string` | `@IsOptional()`, `@IsString()` | Optional | Salvage / alternate remarks |
| `raisedByName` | `string` | `@IsNotEmpty()`, `@IsString()` | Required | Submitter display name |

*   **Database Records Created:**
    1.  `defect_reports`: Inserts row with `scOrPoNo`, `scNo`, `poNo`, `componentName`, `quantity`, `stageOfFailure`, `defectDescription`, `errorTypeName`, `reworkDescription`, `rejectionDescription`, `rejectionProcessTemplate`, `rejectionFailedStage`, `rejectionStageCosts`, `inspectionType`, `raisedByRole = OPERATOR`, `raisedById = null`, `status = PENDING_ACCOUNTS_REVIEW`, `images = []`, `reportNumber` ([internal.service.ts#L57-L79](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.service.ts#L57-L79)).
    2.  `report_sequence`: Locks row `id = 'AGIPL'` (`pessimistic_write`), increments `lastValue += 1` ([internal.service.ts#L44-L55](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.service.ts#L44-L55)).
    3.  `inspection_details`: Inserts child row with `reportId`, `inspectorId = null`, `responsibleParty`, `reworkDescription`, `rejectionDescription`, `rejectionProcessTemplate`, `rejectionFailedStage`, `rejectionStageCosts`, `costEstimate`, `lossAmount`, `alternativeNote`, `decision = REWORK | SCRAP` ([internal.service.ts#L99-L114](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.service.ts#L99-L114)).
*   **Response Shape:** `{ "reportId": "<uuid>", "reportNumber": "AGIPL-YYYY-ERR-XXXXX" }` ([internal.service.ts#L116-L119](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.service.ts#L116-L119)).
*   **Idempotency & Re-submission Behavior:**
    *   *Short-term (<= 10 mins):* `IdempotencyInterceptor` ([ecr-system/src/common/interceptors/idempotency.interceptor.ts#L20-L96](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/common/interceptors/idempotency.interceptor.ts#L20-L96)) maintains an in-memory TTL cache (keyed on `x-idempotency-key` or SHA-256 payload hash). If identical payload arrives while processing, throws `409 Conflict`. If completed, returns cached JSON without creating records.
    *   *Long-term / Post-Restart (> 10 mins):* No persistent database uniqueness or external deduplication key exists. Resending the payload increments `report_sequence`, minting a duplicate `DefectReport` and `InspectionDetail`.

### 1.2 Inbound Stores Sync: `POST /api/internal/material-issued`
*   **Guard & Validation:** `InternalSecretGuard`, validated via `MaterialIssuedDto` ([ecr-system/src/internal/dto/material-issued.dto.ts#L3-L27](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/dto/material-issued.dto.ts#L3-L27)).
*   **Payload Fields:** `ecrId` (string, required), `reportNumber` (string, required), `issuedAt` (ISO date string, required), `issuedQty` (positive number, required), `stockTransactionId` (string, required), `issuedByName` (string, required).
*   **Records Created / Updated:**
    1.  `component_issue`: Inserts row with `reportId`, `issuedToId = null`, `components = [{ componentName, qty, source: 'RM_VSMART' }]`, `remarks` linking `stockTransactionId` and `issuedByName` ([internal.service.ts#L158-L171](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.service.ts#L158-L171)).
    2.  `defect_reports`: Updates `componentsIssued = true`, `componentsIssuedAt = issuedAt`, `componentsIssuedById = 'RM_SYSTEM'`, `status = COMPONENTS_ISSUED` ([internal.service.ts#L173-L177](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.service.ts#L173-L177)).
*   **Response Shape:** `{ "success": true, "reportNumber": "AGIPL-2026-ERR-00104", "newStatus": "COMPONENTS_ISSUED" }`.
*   **Idempotency:** State-guarded. If report status is already `COMPONENTS_ISSUED` or `CLOSED`, returns `{ "success": true, "message": "Already processed" }` without re-issuing components ([internal.service.ts#L145-L150](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.service.ts#L145-L150)).

---

## 2. Defect Report Data Model

Defect reports are stored in `defect_reports` with child tables for inspection details, approvals, issues, and audit logs.

### 2.1 Table Schema: `defect_reports`
Defined in [ecr-system/src/defect-reports/defect-report.entity.ts#L22-L140](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-report.entity.ts#L22-L140).

| Column Name | Database Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | No | Primary Key (`PrimaryGeneratedColumn('uuid')`) |
| `reportNumber` | `varchar` | Yes (Unique) | Formatted ID: `AGIPL-YYYY-ERR-XXXXX` |
| `raised_by_id` | `uuid` | Yes | Foreign Key to `users.id` (null on RM intake) |
| `raisedByRole` | `varchar` (`enum`) | No | `OPERATOR`, `INSPECTOR`, `SENIOR_MANAGER` |
| `scOrPoNo` | `varchar` | No | Composite identifier: `"<scNo> / <poNo>"` |
| `scNo` | `varchar` | Yes | Subcontract order number (free text) |
| `poNo` | `varchar` | Yes | Purchase order number (free text) |
| `productId` | `varchar` | Yes | Product identifier (free text) |
| `componentName` | `varchar` | Yes | Component name / item code (free text) |
| `errorTypeName` | `varchar` | Yes | Failure classification (free text) |
| `partNumber` | `varchar` | Yes | Part number (free text) |
| `batchNumber` | `varchar` | Yes | Production lot / melt / heat batch number |
| `quantity` | `int` | No | Defective component count (default 1) |
| `stageOfFailure` | `varchar` | No | Stage / operation name where defect occurred |
| `defectDescription` | `text` | No | Comprehensive defect narrative |
| `reworkDescription` | `text` | Yes | Machine rework instructions |
| `images` | `simple-json` | No | Serialized JSON string array of image URLs |
| `status` | `varchar` (`enum`) | No | Lifecycle status (default `DRAFT`) |
| `inspectionType` | `varchar` | Yes | `'REWORK'` or `'REJECTION'` |
| `componentsIssued` | `boolean` | No | Replacement parts issued flag (default `false`) |
| `componentsIssuedById` | `varchar` | Yes | Actor ID or `'RM_SYSTEM'` |
| `componentsIssuedAt` | `timestamp` | Yes | Store issue completion timestamp |
| `issueRemarks` | `text` | Yes | Stores issue transaction remarks |
| `sales_description` | `text` | Yes | Accounts review remarks (`accountsDescription`) |
| `rejection_process_template`| `varchar` | Yes | Routing template key for rejected parts |
| `rejection_failed_stage` | `varchar` | Yes | Specific operation stage where scrap occurred |
| `rejection_stage_costs` | `json` | Yes | Breakdown map of costs accrued per stage |
| `rejection_description` | `text` | Yes | Root cause rationale for component scrap |
| `createdAt` | `timestamp` | No | Record creation timestamp (`@CreateDateColumn()`) |
| `updatedAt` | `timestamp` | No | Record mutation timestamp (`@UpdateDateColumn()`) |

### 2.2 Status Enum & Identity Formats
*   **Enum `ReportStatus`** ([ecr-system/src/common/enums/report-status.enum.ts#L1-L15](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/common/enums/report-status.enum.ts#L1-L15)):
    `DRAFT`, `PENDING_INSPECTION`, `INSPECTOR_DRAFT`, `PENDING_ACCOUNTS_REVIEW`, `ACCOUNTS_DRAFT`, `PENDING_SM_REVIEW`, `PENDING_GM_APPROVAL`, `APPROVED`, `REJECTED`, `COMPONENTS_ISSUED`, `REWORK_IN_PROGRESS`, `NEW_PRODUCTION`, `CLOSED`.
*   **Report Identification:**
    *   Primary Key: UUID v4 (`id`, e.g. `c7a8b139-4d8e-49b8-a764-2d0473a2130e`).
    *   Human-readable Sequence: `AGIPL-YYYY-ERR-XXXXX` (e.g. `AGIPL-2026-ERR-00042`), incremented under transaction lock from table `report_sequence` (`id = 'AGIPL'`) ([defect-reports-mutation.service.ts#L44-L60](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-mutation.service.ts#L44-L60)).

### 2.3 Operational Field Linkage Specifications

| Entity Link | Table & Column | Storage Type | FK or Free Text | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Subcontract (SC)** | `defect_reports.scNo` | `varchar` | Free Text | Subcontract order string |
| **Purchase Order (PO)**| `defect_reports.poNo` | `varchar` | Free Text | Purchasing contract string |
| **Product** | `defect_reports.productId` | `varchar` | Free Text | Product identifier string |
| **Component** | `defect_reports.componentName` | `varchar` | Free Text | Component title string |
| **Operation / Stage** | `defect_reports.stageOfFailure` | `varchar` | Free Text | Process operation string |
| **Operator (Raiser)** | `defect_reports.raised_by_id` | `uuid` | Foreign Key (`users.id`) | Null when raised via RM intake |
| **Operator (At Fault)**| `inspection_details.responsibleId`| `varchar` | Free Text / User ID | Set during inspection |
| **Quantity** | `defect_reports.quantity` | `integer` | Value (`int`) | Defective unit quantity (>= 1) |

---

## 3. External Reference Field & Outbound RM Notification

### 3.1 Field Existence: `productionRef`
*   **Status: NOT FOUND.**
*   **Search Locations:** Searched `defect-report.entity.ts`, `inspection-detail.entity.ts`, `create-defect-report.dto.ts`, `rm-intake.dto.ts`, and full repository git grep for `productionRef`, `externalRef`, and `rmReportId`.
*   **Feasibility:** A nullable column `@Column({ type: 'varchar', nullable: true }) productionRef?: string;` can be safely added to `defect_reports`. Existing frontend pages (`NewReportPage.jsx`, `ReportDetailPage.jsx`) deserialize JSON directly and ignore unknown attributes, preventing UI breakage.

### 3.2 Outbound Bridge: `POST /api/internal/ecr/material-pending`
*   **Trigger Point:** Listener `handleApprovedNotifyRm` ([ecr-system/src/notifications/notification.listener.ts#L188-L257](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/notifications/notification.listener.ts#L188-L257)) reacts to event `report.status.changed` when status transitions to `APPROVED` (fired by `gmApprove` in [defect-reports-workflow.service.ts#L396](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-workflow.service.ts#L396)).
*   **Target URL:** `${RM_API_URL}/api/internal/ecr/material-pending` (default: `https://v-smart-backend.onrender.com` or `http://localhost:3001`).
*   **Auth Header:** `x-internal-secret: <RM_INTERNAL_SECRET>`.

| Payload Field | Source Expression | Type | Description |
| :--- | :--- | :--- | :--- |
| `ecrId` | `report.id` | `string` (`uuid`) | ECR primary key |
| `reportNumber` | `report.reportNumber` | `string` | Unique report number |
| `type` | `report.inspectionType \|\| 'REWORK'` | `'REWORK' \| 'REJECTION'` | Defect classification |
| `scNumber` | `report.scNo \|\| report.scOrPoNo \|\| 'N/A'` | `string` | Subcontract reference |
| `poNumber` | `report.poNo \|\| report.scOrPoNo \|\| 'N/A'` | `string` | Purchase order reference |
| `component` | `report.componentName \|\| 'Unknown'` | `string` | Part name |
| `quantityAffected` | `report.quantity \|\| 1` | `number` | Quantity requiring replacement |
| `approvedAt` | `new Date().toISOString()` | `string` (ISO 8601) | Timestamp of GM approval |

*Note: `productionRef` is currently omitted from this outbound payload because it is not captured at intake.*

---

## 4. Approval Workflow & Lifecycle State Transitions

The ECR state machine transitions reports through quality, accounting, executive, and physical fulfillment gates.

```
[DRAFT] ──> [PENDING_INSPECTION] ──> [PENDING_ACCOUNTS_REVIEW] ──> [PENDING_SM_REVIEW] ──> [PENDING_GM_APPROVAL] ──> [APPROVED] ──> [COMPONENTS_ISSUED] ──> [CLOSED]
                 │                           ▲                                                      │
                 └──(Inspector Raise)────────┘                                                      └──> [REJECTED]
```

| From Status | To Status | Authorized Role | Trigger Endpoint / Function | Handler Location |
| :--- | :--- | :--- | :--- | :--- |
| `DRAFT` | `PENDING_INSPECTION` | `OPERATOR`, `ADMIN` | `POST /api/defect-reports` (`create`) | `DefectReportsMutationService.create` ([defect-reports-mutation.service.ts#L70-L167](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-mutation.service.ts#L70-L167)) |
| *Intake Bypass* | `PENDING_ACCOUNTS_REVIEW` | System (`RM_BRIDGE`) | `POST /api/internal/rm-intake` | `InternalService.createFromRM` ([internal.service.ts#L40-L127](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.service.ts#L40-L127)) |
| *Inspector Bypass* | `PENDING_ACCOUNTS_REVIEW` | `INSPECTOR` | `POST /api/defect-reports` (`create`) | `DefectReportsMutationService.create` ([defect-reports-mutation.service.ts#L168-L196](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-mutation.service.ts#L168-L196)) |
| `PENDING_INSPECTION` | `PENDING_ACCOUNTS_REVIEW` | `INSPECTOR` | `PATCH /api/defect-reports/:id/inspect` | `DefectReportsWorkflowService.inspect` ([defect-reports-workflow.service.ts#L91-L199](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-workflow.service.ts#L91-L199)) |
| `PENDING_INSPECTION` | `INSPECTOR_DRAFT` | `INSPECTOR` | `PATCH /api/defect-reports/:id/inspect` (`saveAsDraft`) | `DefectReportsWorkflowService.inspect` ([defect-reports-workflow.service.ts#L168-L175](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-workflow.service.ts#L168-L175)) |
| `PENDING_ACCOUNTS_REVIEW`| `PENDING_SM_REVIEW` | `ACCOUNTS` | `PATCH /api/defect-reports/:id/status` | `DefectReportsWorkflowService.transitionStatus` ([defect-reports-workflow.service.ts#L644-L730](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-workflow.service.ts#L644-L730)) |
| `PENDING_ACCOUNTS_REVIEW`| `ACCOUNTS_DRAFT` | `ACCOUNTS` | `PATCH /api/defect-reports/:id/status` | `DefectReportsWorkflowService.transitionStatus` ([defect-reports-workflow.service.ts#L681-L685](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-workflow.service.ts#L681-L685)) |
| `PENDING_SM_REVIEW` | `PENDING_GM_APPROVAL` | `SENIOR_MANAGER` | `PATCH /api/defect-reports/:id/sm-review` (`forwardToGm: true`) | `DefectReportsWorkflowService.smReview` ([defect-reports-workflow.service.ts#L201-L328](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-workflow.service.ts#L201-L328)) |
| `PENDING_SM_REVIEW` | `REJECTED` | `SENIOR_MANAGER` | `PATCH /api/defect-reports/:id/sm-review` (`forwardToGm: false`) | `DefectReportsWorkflowService.smReview` ([defect-reports-workflow.service.ts#L307](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-workflow.service.ts#L307)) |
| `PENDING_GM_APPROVAL` | `APPROVED` | `GENERAL_MANAGER` | `PATCH /api/defect-reports/:id/gm-approve` (`approved: true`) | `DefectReportsWorkflowService.gmApprove` ([defect-reports-workflow.service.ts#L330-L408](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-workflow.service.ts#L330-L408)) |
| `PENDING_GM_APPROVAL` | `REJECTED` | `GENERAL_MANAGER` | `PATCH /api/defect-reports/:id/gm-approve` (`approved: false`) | `DefectReportsWorkflowService.gmApprove` ([defect-reports-workflow.service.ts#L373](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-workflow.service.ts#L373)) |
| `APPROVED` | `COMPONENTS_ISSUED` | `STORE_MANAGER` / RM | `PATCH /:id/issue-components` or `POST /internal/material-issued` | `issueComponents` ([workflow.service.ts#L732](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-workflow.service.ts#L732)) / `handleMaterialIssued` ([internal.service.ts#L129](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.service.ts#L129)) |
| `COMPONENTS_ISSUED` | `REWORK_IN_PROGRESS` | `SM`, `GM`, `ADMIN` | `PATCH /api/defect-reports/:id/status` | `DefectReportsWorkflowService.transitionStatus` ([defect-reports-workflow.service.ts#L672](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-workflow.service.ts#L672)) |
| `COMPONENTS_ISSUED` | `NEW_PRODUCTION` | `SM`, `GM`, `ADMIN` | `PATCH /api/defect-reports/:id/status` | `DefectReportsWorkflowService.transitionStatus` ([defect-reports-workflow.service.ts#L672](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-workflow.service.ts#L672)) |
| `COMPONENTS_ISSUED` | `CLOSED` | `SM`, `GM`, `ADMIN` | `PATCH /api/defect-reports/:id/status` | `DefectReportsWorkflowService.transitionStatus` ([defect-reports-workflow.service.ts#L672](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports-workflow.service.ts#L672)) |

---

## 5. Integrations, Queues, Schedulers & Inbound Auth

### 5.1 Outbound Integrations
1.  **RM / V-Smart Webhook:** `POST ${RM_API_URL}/api/internal/ecr/material-pending` in `NotificationListener.handleApprovedNotifyRm` ([notification.listener.ts#L222-L249](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/notifications/notification.listener.ts#L222-L249)).
2.  **Email Delivery (Dual-Provider):** Dispatches via Google Apps Script (GAS) Web App HTTPS endpoint (`GMAIL_SCRIPT_URL`) or direct SMTP (`nodemailer`) with automatic failover ([ecr-system/src/email/services/email.service.ts#L100-L240](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email.service.ts#L100-L240)).

### 5.2 Outbox & Queue Tables
ECR uses relational database tables rather than dedicated message brokers (Kafka, RabbitMQ, BullMQ):
1.  `email_logs` ([ecr-system/src/email/entities/email-log.entity.ts#L16-L74](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/entities/email-log.entity.ts#L16-L74)): Stores outgoing email queue with statuses `PENDING`, `SENT`, `FAILED`, `CANCELLED`, tracking `retryCount` and `failureReason`.
2.  `notifications` ([ecr-system/src/notifications/notification.entity.ts#L17-L70](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/notifications/notification.entity.ts#L17-L70)): Stores in-app user notifications with statuses `QUEUED`, `SENT`, `FAILED`, `DELIVERED`.

### 5.3 Background Schedulers & Retry Mechanics
1.  **Email Queue Dispatcher:** `@Cron(CronExpression.EVERY_MINUTE)` and `@OnEvent('email.logs.updated')` in `EmailQueueService.processEmailQueue` ([email-queue.service.ts#L88-L146](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L88-L146)). Polls `email_logs`, applies a 5-email/min rate throttle, and retries failed deliveries up to 3 times (`maxRetries = 3`).
2.  **Notification Retry Cron:** Scheduled annually (`@Cron('0 0 1 1 *')`) in `NotificationRetryCron.handleRetry` ([notification-retry.cron.ts#L36-L69](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/notifications/notification-retry.cron.ts#L36-L69)). Sub-minute execution disabled to avoid polling overhead.
3.  **RM Webhook Retry Logic:** **NO RETRY LOGIC.** In `notification.listener.ts#L250-L256`, failure triggers a `console.error` noting `manual retry needed`. There is no queue table, backoff, or automated retry for outbound RM notifications.

### 5.4 Inbound Service-to-Service Auth Guard
*   `InternalSecretGuard` ([ecr-system/src/internal/guards/internal-secret.guard.ts#L4-L13](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/guards/internal-secret.guard.ts#L4-L13)): Protects `/api/internal/*`. Evaluates request header `x-internal-secret` against environment variable `ECR_INTERNAL_SECRET`.

---

## 6. Technical Stack & Runtime Specifications

| Category | Specification | Reference / Citation |
| :--- | :--- | :--- |
| **Backend Framework** | NestJS `v10.4.0` (Node.js runtime, Express platform) | [ecr-system/package.json#L15-L21](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/package.json#L15-L21) |
| **ORM** | TypeORM `v0.3.31` (`@nestjs/typeorm v10.0.2`) | [ecr-system/package.json#L26, L44](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/package.json#L26) |
| **Database Engine & Host**| PostgreSQL (`pg v8.12.0`), hosted on Neon Cloud PostgreSQL (`ssl: { rejectUnauthorized: false }`) | [app.module.ts#L89-L91](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/app.module.ts#L89-L91), [.env.example#L5-L6](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/.env.example#L5-L6) |
| **Primary Key ID Types** | UUID v4 (`string`, `@PrimaryGeneratedColumn('uuid')`) | `defect-report.entity.ts#L24-L25` |
| **Sequence ID Type** | String sequence (`report_sequence`, `id = 'AGIPL'`, `lastValue = int`) | `report-sequence.entity.ts#L4-L9` |
| **Timestamp Conventions** | UTC ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`) in APIs; PostgreSQL `timestamp without time zone` in DB | `date-format.ts#L1-L20` |
| **API Base URL** | `http://localhost:3000/api` (default port 3000, prefix `/api`) | [main.ts#L79-L83](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/main.ts#L79-L83) |
| **Frontend Base URL** | `http://localhost:5173` (configured via `FRONTEND_URL`) | [.env.example#L27](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/.env.example#L27) |
| **RM Sibling API Base** | `https://v-smart-backend.onrender.com` or `http://localhost:3001` (`RM_API_URL`) | [notification.listener.ts#L199](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/notifications/notification.listener.ts#L199) |

---

## 7. Sample Defect Reports (Redacted JSON)

### 7.1 Rework Defect Report Sample
```json
{
  "id": "3b29c9a0-6f2e-4b2a-89a1-57d6201e74a1",
  "reportNumber": "AGIPL-2026-ERR-00042",
  "raisedById": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "raisedByRole": "OPERATOR",
  "scOrPoNo": "SC-2026-0819 / PO-4500032110",
  "scNo": "SC-2026-0819",
  "poNo": "PO-4500032110",
  "productId": "PROD-VALVE-FLG",
  "componentName": "Forged Flange Body 2-Inch",
  "errorTypeName": "Machining Runout",
  "partNumber": "V-FLG-002",
  "batchNumber": "HEAT-9821A",
  "quantity": 2,
  "stageOfFailure": "OP20_FACING",
  "defectDescription": "Surface finish on sealing face measured Ra 3.2 vs specified Ra 0.8.",
  "reworkDescription": "Skim 0.15mm off face in CNC lathe and polish to Ra 0.8.",
  "images": ["https://res.cloudinary.com/demo/image/upload/sample_flange.jpg"],
  "status": "APPROVED",
  "inspectionType": "REWORK",
  "componentsIssued": false,
  "componentsIssuedById": null,
  "componentsIssuedAt": null,
  "issueRemarks": null,
  "inspectionDetail": {
    "id": "e4f5a6b7-c8d9-0e1f-2a3b-4c5d6e7f8a9b",
    "reportId": "3b29c9a0-6f2e-4b2a-89a1-57d6201e74a1",
    "inspectorId": "f7e8d9c0-b1a2-3f4e-5d6c-7b8a9e0f1a2b",
    "responsibleParty": "OPERATOR",
    "responsibleId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "decision": "REWORK",
    "costEstimate": 1500.00,
    "materialCost": 300.00,
    "labourCost": 1200.00,
    "otherCost": 0.00,
    "costRemarks": "Requires 1.5 lathe machinist hours",
    "timeEstimateHours": 1.5,
    "lossAmount": 300.00,
    "reviewedAt": "2026-11-20T08:30:00.000Z"
  },
  "createdAt": "2026-11-20T08:00:00.000Z",
  "updatedAt": "2026-11-20T11:45:00.000Z"
}
```

### 7.2 Rejection (Scrap) Defect Report Sample
```json
{
  "id": "9c8b7a65-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
  "reportNumber": "AGIPL-2026-ERR-00043",
  "raisedById": null,
  "raisedByRole": "OPERATOR",
  "scOrPoNo": "SC-2026-1044 / PO-4500034902",
  "scNo": "SC-2026-1044",
  "poNo": "PO-4500034902",
  "productId": "PROD-ACTUATOR-STEM",
  "componentName": "Actuator Drive Stem 410SS",
  "errorTypeName": "Critical Undersize",
  "partNumber": "V-STM-410",
  "batchNumber": "MELT-5510B",
  "quantity": 1,
  "stageOfFailure": "OP40_THREAD_MILLING",
  "defectDescription": "Pitch diameter turned 0.8mm undersize; threads cannot engage nut.",
  "reworkDescription": null,
  "rejectionProcessTemplate": "STEM_MACHINING_V1",
  "rejectionFailedStage": "OP40_THREAD_MILLING",
  "rejectionStageCosts": {
    "OP10_RAW_BAR_CUTTING": 1200.00,
    "OP20_ROUGH_TURNING": 2400.00,
    "OP30_HEAT_TREATMENT": 1800.00,
    "OP40_THREAD_MILLING": 3100.00
  },
  "rejectionDescription": "Part wall thickness exhausted; cannot be sleeved or re-threaded. Scrap entire piece.",
  "images": [],
  "status": "COMPONENTS_ISSUED",
  "inspectionType": "REJECTION",
  "componentsIssued": true,
  "componentsIssuedById": "RM_SYSTEM",
  "componentsIssuedAt": "2026-11-21T14:30:00.000Z",
  "issueRemarks": "Issued from RM/V-Smart by Stores Manager. Stock TX: STX-99812",
  "inspectionDetail": {
    "id": "1a2b3c4d-5e6f-7a8b-9c0d-ef0123456789",
    "reportId": "9c8b7a65-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
    "inspectorId": null,
    "responsibleParty": "VENDOR",
    "responsibleId": "VEND-PRECISION-CNC",
    "decision": "SCRAP",
    "costEstimate": 8500.00,
    "materialCost": 1200.00,
    "labourCost": 7300.00,
    "otherCost": 0.00,
    "lossAmount": 8500.00,
    "reviewedAt": "2026-11-21T09:15:00.000Z"
  },
  "createdAt": "2026-11-21T09:00:00.000Z",
  "updatedAt": "2026-11-21T14:30:00.000Z"
}
```

---

## 8. Integration Gaps & Automation Blockers

The following systemic architectural gaps must be addressed to enable reliable machine-to-machine event ingestion (rejections, reworks, additional-process triggers):

| # | Gap Area | Current Behavior | Impact on Machine Integration | Recommended Remediation |
| :- | :--- | :--- | :--- | :--- |
| **1** | **Persistent Deduplication** | Only in-memory 10-minute cache (`IdempotencyInterceptor`). No DB uniqueness on external keys. | Network timeouts or retries > 10 min generate duplicate ECRs and double-deductions. | Add unique column `external_ref` / `production_ref` on `defect_reports`. |
| **2** | **External Ref Propagation** | `productionRef` does not exist on `DefectReport` and is not returned in outbound RM webhooks. | RM cannot correlate GM approval callbacks back to original production / work orders. | Store `productionRef` at intake; echo it in `POST .../material-pending`. |
| **3** | **Required Human Fields** | `RmIntakeDto` mandates `raisedByName` (`@IsNotEmpty()`) and both `scNumber` + `poNumber`. | Automated system events lacking human operator names or having only an SC/PO are rejected (400). | Allow synthetic machine raiser (`"RM_SYSTEM"`) and make `poNumber` / `scNumber` mutually optional. |
| **4** | **Unmapped Operator Name** | `RmIntakeDto.operatorName` is accepted but discarded in `internal.service.ts`. | Responsible operator is lost; quality traceability defaults to null. | Persist `operatorName` to `inspection_details.responsibleId` / notes. |
| **5** | **Free-Text Master Data** | `scNo`, `poNo`, `componentName`, `stageOfFailure` stored as free-text strings without foreign keys. | Typos from external systems corrupt reporting and prevent automated ERP cross-referencing. | Add master data resolution pipe linking component/vendor codes. |
| **6** | **Missing Workflow Enum** | `inspectionType` is strictly `'REWORK' \| 'REJECTION'`. No "Additional Process" type. | Intermediate process rework / deviation requests cannot be categorized correctly. | Add `'ADDITIONAL_PROCESS'` to `inspectionType` and report flows. |
| **7** | **Mandatory Human Accounting** | `DefectReportsWorkflowService.transitionStatus` requires non-null manual cost entries before SM review. | Automated intake cannot achieve straight-through processing even for low-value scrap. | Permit auto-derived cost thresholds or machine-provided financial defaults. |
| **8** | **Outbound Webhook Resiliency** | Outbound RM webhook is fire-and-forget `fetch` with no retries or dead-letter queue. | If RM is temporarily offline during GM approval, material release notification is permanently lost. | Persist outbound webhooks to an outbox table; retry via cron scheduler. |
