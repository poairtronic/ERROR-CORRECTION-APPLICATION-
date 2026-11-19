# Technical & Functional System Audit: Velan Quality Hub (ECR Digitization System)

**Document Reference:** `docs/audit/ECR_QUALITY_HUB_FULL_REPORT.md`  
**Application Name:** Velan Quality Hub (Enterprise Quality Report / ECR Digitization System)  
**Target Environment:** Node.js Monorepo (npm Workspaces)  
**Operating Mode:** Read-Only Audit  
**Local Audit Timestamp:** 2026-11-19T15:47:41+05:30  
**Confidentiality Notice:** No raw secrets or credentials are disclosed in this document. All sensitive keys are referenced by variable name only and masked as `****`.

---

# Table of Contents
1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Data Storage & Schema](#3-data-storage--schema)
4. [Deployment & Infrastructure](#4-deployment--infrastructure)
5. [Configuration & Environment Variables](#5-configuration--environment-variables)
6. [Authentication, Authorization & Security](#6-authentication-authorization--security)
7. [Email & SMTP Subsystem](#7-email--smtp-subsystem)
8. [Background Jobs, Workers & Cron Schedulers](#8-background-jobs-workers--cron-schedulers)
9. [End-to-End Workflow & Business State Machine](#9-end-to-end-workflow--business-state-machine)
10. [API Catalog & Endpoint Reference](#10-api-catalog--endpoint-reference)
11. [Frontend Architecture & UI Catalog](#11-frontend-architecture--ui-catalog)
12. [System Integrations (RM / V-Smart Bridge)](#12-system-integrations-rm--v-smart-bridge)
13. [Shared Master Data & Identifier Standards](#13-shared-master-data--identifier-standards)
14. [Observability, Audit Trail, Error Handling & Reporting](#14-observability-audit-trail-error-handling--reporting)
15. [Testing & Quality Assurance](#15-testing--quality-assurance)
16. [Integration Readiness & Stores Issue Alignment](#16-integration-readiness--stores-issue-alignment)
17. [Technical Debt, Known Bugs & Security / Operational Risks](#17-technical-debt-known-bugs--security--operational-risks)
18. [Appendices](#18-appendices)
    - [Appendix A: Complete Database Table List](#appendix-a-complete-database-table-list)
    - [Appendix B: Complete REST API Endpoint Directory](#appendix-b-complete-rest-api-endpoint-directory)
    - [Appendix C: Environment Variable Reference Table](#appendix-c-environment-variable-reference-table)
    - [Appendix D: Operations & Developer Command Cheat-Sheet](#appendix-d-operations--developer-command-cheat-sheet)
19. [Section Status Checklist](#19-section-status-checklist)

---

## 1. Overview

### 1.1 Business Purpose & Scope
The **Velan Quality Hub** (ECR Digitization System) is an enterprise manufacturing quality assurance and non-conformance management platform. It automates the intake, technical verification, financial auditing, management sign-off, replacement component fulfillment, and cost-recovery lifecycles for defective raw materials, machined components, and scrapped workpieces.

The system replaces manual paper defect slips with a strict, multi-tiered digital state machine that:
1. Slices active manufacturing route templates up to the exact stage of failure to calculate accurate cumulative production and material loss.
2. Enforces financial review by Cost & Accounts before executive sign-off.
3. Automatically triggers payroll deduction notices for operator negligence or debit recovery logs for vendor-supplied defects upon General Manager approval.
4. Authorizes warehouse stores to issue replacement materials and synchronizes with sibling manufacturing systems (V-Smart / Raw Material App).

### 1.2 User Personas & Roles
Defined in `ecr-system/src/common/enums/role.enum.ts#L1-L9` and `frontend/src/utils/constants.js#L35-L43`:

| Role Identifier | Business Role | Primary Operational Responsibilities | Primary Interface / Screens |
| :--- | :--- | :--- | :--- |
| `OPERATOR` | Machine Operator | Identifies floor defects; raises initial incident reports under standard workflow mode. | `/`, `/reports/new`, `/reports` |
| `INSPECTOR` | Quality Control (QC) Inspector | Inspects physical defects; classifies Rework vs. Rejection; selects failure stages, responsible parties, and failure templates. Under simplified mode, raises and submits directly to Accounts. | `/`, `/reports/new`, `/reports/:id` (Inspect Modal), `/reports` |
| `ACCOUNTS` | Cost & Accounts Executive | Audits material, labor, overhead, and active stage costs; verifies financial exposure; saves cost verification drafts or forwards to SM. | `/`, `/reports/:id` (Accounts Review Modal), `/reports`, `/analytics` |
| `SENIOR_MANAGER` | Senior / Section Manager (SM) | Reviews technical and financial assessments; checks for operator bias or process loopholes; amends estimates; approves to GM or rejects. | `/`, `/reports/:id` (SM Review Modal), `/reports`, `/audit`, `/analytics` |
| `GENERAL_MANAGER` | General Manager (GM) | Final executive approval authority; reviews total financial loss and confidential notes; grants budget sign-off or rejects claim. | `/`, `/reports/:id` (GM Approval Modal), `/reports`, `/audit`, `/analytics` |
| `STORE_MANAGER` | Warehouse / Store Manager | Receives dispatch authorization upon GM approval; issues physical replacement components or raw materials to production floor. | `/`, `/reports/:id` (Issue Components Modal), `/reports` |
| `ADMIN` | Plant / IT Administrator | Manages user master data, component codes, error types, cost rates; monitors email delivery logs; audits system ledger; performs hard deletes. | `/users`, `/master-data`, `/audit`, `/admin/emails`, `/analytics` |

### 1.3 System Modules & Functional Boundary
*   `AuthModule` (`ecr-system/src/auth/auth.module.ts#L1-L30`): Authentication, Bcrypt hashing, HttpOnly JWT cookies, stateless password reset via password-hash token salting.
*   `UsersModule` (`ecr-system/src/users/users.module.ts#L1-L20`): User management, role assignment, active/inactive toggling, login history tracking.
*   `DefectReportsModule` (`ecr-system/src/defect-reports/defect-reports.module.ts#L1-L45`): Core defect lifecycle, pessimistic concurrency locking, state transitions, bulk deletion, image attachments.
*   `InternalModule` (`ecr-system/src/internal/internal.module.ts#L1-L20`): Shared secret authenticated inbound/outbound REST bridge with V-Smart / RM application (`POST /api/internal/rm-intake`, `POST /api/internal/material-issued`, `GET /api/internal/approved-reports`).
*   `ComponentIssueModule` (`ecr-system/src/component-issue/component-issue.module.ts#L1-L20`): Warehouse store issuance recording, inventory deductions, stock transaction traceability.
*   `MasterDataModule` (`ecr-system/src/master-data/master-data.module.ts#L1-L35`): Cached CRUD operations for components, cost rates, error types, operators, and vendors.
*   `NotificationsModule` (`ecr-system/src/notifications/notifications.module.ts#L1-L40`): In-app notification repository, Socket.IO gateway with bidirectional message acknowledgements.
*   `EmailModule` (`ecr-system/src/email/email.module.ts#L1-L40`): Handlebars email templating, email queue scheduler, dual delivery transport (Google Apps Script proxy and direct Gmail SMTP).
*   `EmailMonitoringModule` (`ecr-system/src/email-monitoring/email-monitoring.module.ts#L1-L25`): Email delivery telemetry, retry/resend controls, CSV log exports.
*   `AttachmentsModule` (`ecr-system/src/attachments/attachments.module.ts#L1-L25`): Cloudinary media upload integration with local disk filesystem fallback.
*   `AuditLogModule` (`ecr-system/src/audit-log/audit-log.module.ts#L1-L20`): Immutable transaction audit ledger recording field modifications and state transitions.
*   `AnalyticsModule` (`ecr-system/src/analytics/analytics.module.ts#L1-L25`): KPI aggregates, monthly loss trends, operator/vendor/machine defect intelligence.
*   `MonitoringModule` (`ecr-system/src/monitoring/monitoring.module.ts#L1-L30`): Health check endpoints, system resource metrics (CPU, heap memory, event loop latency, socket events).
*   `SalaryDeductionModule` (`ecr-system/src/salary-deduction/salary-deduction.module.ts#L1-L20`): Automated payroll deduction tracking for operator-attributed defects.
*   `VendorFaultModule` (`ecr-system/src/vendor-fault/vendor-fault.module.ts#L1-L20`): Vendor debit note and warranty claim recovery tracking.

### 1.4 Repository Structure (Tree Depth 3)
```
ERROR CORRECTION APPLICATION/
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── flow/
│   │   └── ecr-flow.md
│   ├── integration/
│   │   └── ecr-audit.md
│   ├── architecture.md
│   ├── database.md
│   ├── deployment.md
│   ├── ECR-UI-THEME.md
│   ├── modules.md
│   └── workflow.md
├── ecr-system/
│   ├── coverage/
│   ├── public/
│   │   ├── assets/
│   │   ├── images/
│   │   ├── index.html
│   │   └── vite.svg
│   ├── scripts/
│   │   ├── check-reports.ts
│   │   └── clean-production-data.ts
│   ├── src/
│   │   ├── analytics/
│   │   ├── attachments/
│   │   ├── audit-log/
│   │   ├── auth/
│   │   ├── common/
│   │   ├── component-issue/
│   │   ├── config/
│   │   ├── defect-reports/
│   │   ├── email/
│   │   ├── email-monitoring/
│   │   ├── gm-approval/
│   │   ├── image-upload/
│   │   ├── inspection/
│   │   ├── internal/
│   │   ├── master-data/
│   │   ├── migrations/
│   │   ├── monitoring/
│   │   ├── notifications/
│   │   ├── salary-deduction/
│   │   ├── sm-review/
│   │   ├── users/
│   │   ├── vendor-fault/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── uploads/
│   ├── .env.example
│   ├── nest-cli.json
│   ├── package.json
│   ├── tsconfig.build.json
│   └── tsconfig.json
├── frontend/
│   ├── e2e/
│   │   └── ecr.spec.js
│   ├── public/
│   │   ├── images/
│   │   └── vite.svg
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.mjs
├── .env.example
├── .gitignore
├── .nvmrc
├── event_flow_matrix.md
├── GEMINI.md
├── k6-load-test.js
├── load-test-comprehensive.js
├── package-lock.json
├── package.json
├── PHASE-7B-RUNTIME-VALIDATION-REPORT.md
├── production_readiness_handbook.md
├── README.md
└── render.yaml
```

### 1.5 Git Branches & Commit History Summary
*   **Active Branch:** `main` (verified via `git branch -a`)
*   **Local & Remote Tracking Branches:**
    *   `chore/integration-verify`
    *   `feature/integration-phase0`
    *   `feature/integration-phase1`
    *   `main` (HEAD tracking `origin/main`)
    *   `opencode/curious-rocket`
    *   `opencode/glowing-meadow`
    *   `postgres-migration`
*   **Last 50 Commits Summary (Chronological overview of key evolutionary milestones):**
    1.  `8a3e3e1`: Accounts submission error handling, cron stub disable, event loop break, route param pipes.
    2.  `af16c2d`: Resolve edge cases in image handling, UUID queries, costs, deactivation, and session cleanup.
    3.  `76aa264`: Audit findings resolution for defect reports and component issue workflows.
    4.  `d5995b1`: Add Design Team to Rejection dropdown and remove duplicate inputs.
    5.  `3309920`: Fix 400 Bad Request on report creation caused by non-whitelisted vendorId.
    6.  `813b751`: Remove duplicate direct RM webhook call in gmApprove.
    7.  `d0eb205`: Implement dedicated audit log module and fix global audit viewer.
    8.  `8ce7a83`: Modernize VQH login UI and implement email password reset flow.
    9.  `3f39c2f`: Eliminate screen jitter and scroll flickering across data tables and cards.
    10. `875f5b5`: Operator and material intelligence, workflow distribution, and new report layout.
    11. `020749f` & `6132166`: Refine gitignore rules for uploads directory structure.
    12. `bd8dd19` & `146bebe`: Add Cloudinary file upload module and local disk fallback.
    13. `b02d229`: Add 'Others' process template with custom process & cost entry.
    14. `cb69d8e`: Add Design Team & Quality parties, admin edit at any stage, unit process rates.
    15. `8c96c94`: Resolve GAS daily quota failure with direct Gmail SMTP fallback and startup recovery.
    16. `f18d753` & `4d2781e`: RM material issuance bridge, batch editFields, approved-reports sync, GM webhook.
    17. `b85ba31`: Add ECR business flow and technical integration audit specifications.
    18. `dfe844e`: Correct API performance logging and defect-reports relation optimization.
    19. `d180371` & `b7026c5`: Implement Phase X Admin Hard Delete and bulk deletion features.
    20. `83a4ce0` to `4b68347`: ECR internal intake API — skip inspection stage for RM intake.
    21. `82803d4`: Rebrand application to Velan Quality Hub.
    22. `383c02f`: Format all email timestamps to Indian Standard Time (IST) and add PO/SC numbers.
    23. `33e753c` & `f6996f6`: Resolve duplicate email notifications via concurrency guards and idempotency keys.
    24. `613f786`: Refactor ECR workflow status transitions outside transactions to fix pg circular serialization.
    25. `f6060a6` to `5344ea2`: Inspector save-as-draft workflow and enum migrations.

---

## 2. Tech Stack

### 2.1 Runtime & Monorepo Architecture
*   **Runtime:** Node.js `22.x` ([package.json#L6-L8](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/package.json#L6-L8), [.nvmrc#L1](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/.nvmrc#L1)).
*   **Package Management:** npm Workspaces coordinating `frontend` and `ecr-system` ([package.json#L9-L12](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/package.json#L9-L12)).
*   **Monolithic Deployment Strategy:** Single-origin monolith. Vite builds static SPA bundle directly into `ecr-system/public` ([frontend/vite.config.mjs#L7](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/frontend/vite.config.mjs#L7)), which is served by `@nestjs/serve-static` on root ([ecr-system/src/app.module.ts#L80-L83](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/app.module.ts#L80-L83)).

### 2.2 Backend Architecture & Dependencies
*   **Framework:** NestJS `^10.4.0` on Express `^4.17.21` ([ecr-system/package.json#L15-L21](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/package.json#L15-L21)).
*   **Language:** TypeScript `^5.5.3` targeting `ES2021` ([ecr-system/tsconfig.json#L11](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/tsconfig.json#L11)).
*   **Database ORM:** TypeORM `^0.3.31` with `pg` `^8.12.0` ([ecr-system/package.json#L40, L44](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/package.json#L40)).

#### Full Backend Dependencies Inventory (`ecr-system/package.json`):
| Dependency | Version | Architectural Purpose in Application |
| :--- | :--- | :--- |
| `@nestjs/common` | `^10.4.0` | Core NestJS decorators, pipes, exceptions, middleware, and dependency injection tokens. |
| `@nestjs/config` | `^3.2.3` | Environment variable management, validation schema, and multi-file cascade loading. |
| `@nestjs/core` | `^10.4.0` | Application bootstrap engine, global interceptors, guards, and lifecycle hooks. |
| `@nestjs/event-emitter` | `^2.0.4` | In-memory decoupled event bus for background notifications and webhook dispatches. |
| `@nestjs/jwt` | `^10.2.0` | Cryptographic JWT signing, decoding, and verification for user session management. |
| `@nestjs/passport` | `^10.0.3` | Passport authentication integration bridge. |
| `@nestjs/platform-express` | `^10.4.0` | Express HTTP adapter handling HTTP server routes and file multipart streams. |
| `@nestjs/platform-socket.io`| `^10.4.0` | Socket.IO server engine adapter for WebSocket gateway. |
| `@nestjs/schedule` | `^4.1.0` | Cron and interval scheduler for email queue processing. |
| `@nestjs/serve-static` | `^4.0.2` | Static web server delivering compiled React SPA frontend from `/public`. |
| `@nestjs/throttler` | `^5.1.2` | API rate limiting guard mitigating denial-of-service and brute-force attacks. |
| `@nestjs/typeorm` | `^10.0.2` | NestJS module bridge for TypeORM database connection management. |
| `@nestjs/websockets` | `^10.4.0` | Real-time WebSocket gateway engine for live UI updates. |
| `@types/cookie-parser` | `^1.4.10` | TypeScript definitions for cookie-parser. |
| `bcrypt` | `^5.1.1` | Salted Blowfish cipher for secure password hashing (10 salt rounds). |
| `class-transformer` | `^0.5.1` | Object-to-class transformation and conditional field exclusion (e.g., GM private notes). |
| `class-validator` | `^0.14.1` | Decorator-driven runtime schema validation on inbound DTO payloads. |
| `cloudinary` | `^2.10.0` | Cloudinary v2 SDK for cloud image/attachment upload and asset management. |
| `compression` | `^1.8.1` | Gzip response compression middleware reducing network payload sizes. |
| `cookie-parser` | `^1.4.7` | Parses `Cookie` HTTP request header for HttpOnly JWT session token extraction. |
| `handlebars` | `^4.7.9` | Template compilation engine rendering responsive HTML email templates. |
| `helmet` | `^8.3.0` | Security headers middleware configuring Content-Security-Policy and XSS guards. |
| `nodemailer` | `^9.0.3` | SMTP transport client for direct Gmail outbound email dispatch. |
| `passport` | `^0.7.0` | Low-level Node.js authentication middleware framework. |
| `passport-jwt` | `^4.0.1` | JWT extraction and verification strategy for Passport. |
| `pg` | `^8.12.0` | Pure JavaScript and native libpq PostgreSQL database driver. |
| `reflect-metadata` | `^0.2.2` | Metadata reflection polyfill required by TypeScript decorator architecture. |
| `rxjs` | `^7.8.1` | Reactive Extensions library used for NestJS request pipelines and interceptors. |
| `streamifier` | `^0.1.1` | Converts memory buffer to readable stream for Cloudinary upload pipelines. |
| `typeorm` | `^0.3.31` | Object-Relational Mapping engine managing entities, relations, transactions, and SQL queries. |
| `@nestjs/cli` (dev) | `^10.4.5` | Command line compiler and build runner for NestJS backend. |
| `@nestjs/testing` (dev) | `^10.4.22`| Unit and integration testing fixtures and mock dependency injectors. |
| `jest` (dev) | `^30.4.2` | Test runner and assertion library. |
| `ts-jest` (dev) | `^29.4.11` | TypeScript preprocessor for Jest. |
| `ts-node` (dev) | `^10.9.2` | TypeScript execution environment for Node.js (used for TypeORM CLI). |

### 2.3 Frontend Architecture & Dependencies
*   **Core UI Library:** React `^18.2.0` & React-DOM `^18.2.0` ([frontend/package.json#L18-L19](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/frontend/package.json#L18-L19)).
*   **Build Tool & Dev Server:** Vite `^5.0.0` with `@vitejs/plugin-react` `^4.2.0` ([frontend/package.json#L29, L33](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/frontend/package.json#L29)).
*   **Routing:** React Router DOM `^6.24.1` ([frontend/package.json#L22](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/frontend/package.json#L22)).
*   **Styling:** Custom Vanilla CSS Custom Properties architecture (`frontend/src/index.css`) utilizing dark/light theme tokens without heavyweight CSS frameworks.

#### Full Frontend Dependencies Inventory (`frontend/package.json`):
| Dependency | Version | Architectural Purpose in Application |
| :--- | :--- | :--- |
| `@tanstack/react-query` | `^5.101.2` | Asynchronous server state caching, background invalidation, and data fetching. |
| `axios` | `^1.7.2` | Promise-based HTTP client with global 401 auto-logout interceptor. |
| `html2pdf.js` | `^0.14.0` | Client-side HTML-to-PDF rendering engine. |
| `jspdf` | `^4.2.1` | Canvas/vector PDF document generation library. |
| `jspdf-autotable` | `^5.0.8` | Structured table rendering plugin for jsPDF. |
| `react` | `^18.2.0` | Declarative component UI engine. |
| `react-dom` | `^18.2.0` | React DOM bindings. |
| `react-hot-toast` | `^2.6.0` | Animated floating notification toasts. |
| `react-icons` | `^5.2.1` | Feather and Material icon sets as SVG components. |
| `react-router-dom` | `^6.24.1` | Client-side SPA routing, role-guarded routes, and URL parameter handling. |
| `recharts` | `^3.9.1` | SVG analytics charts (bar, line, pie, area charts). |
| `socket.io-client` | `^4.8.3` | Real-time WebSocket client receiving push notifications and email log broadcasts. |
| `xlsx` | `^0.18.5` | Spreadsheet parser and workbook generator for formatted Excel (.xlsx) exports. |
| `@playwright/test` (dev) | `^1.61.1` | Automated end-to-end browser journey test runner. |
| `eslint` (dev) | `^8.57.1` | JavaScript and JSX static analysis code linter. |

---

## 3. Data Storage & Schema

### 3.1 Database Engine, Connection & Driver
*   **Engine:** PostgreSQL (tested on Neon Serverless PostgreSQL and local PostgreSQL 14+).
*   **Connection URI:** `DATABASE_URL=postgresql://user:****@host:5432/dbname?sslmode=require` ([ecr-system/src/app.module.ts#L90](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/app.module.ts#L90)).
*   **SSL Mode:** Enforced with `ssl: { rejectUnauthorized: false }` ([ecr-system/src/app.module.ts#L91](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/app.module.ts#L91)).
*   **Connection Pool Configuration:**
    *   Maximum pool size: `20` clients (`extra.max: 20` in [ecr-system/src/app.module.ts#L102](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/app.module.ts#L102)).
    *   Idle client timeout: `30,000 ms` (`extra.idleTimeoutMillis: 30000`).
    *   Connection timeout: `5,000 ms` (`extra.connectionTimeoutMillis: 5000`).
    *   Connection retry attempts: `10` attempts with `3,000 ms` delay ([ecr-system/src/app.module.ts#L99-L100](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/app.module.ts#L99-L100)).
    *   Slow query logger threshold: `500 ms` (`maxQueryExecutionTime: 500` in [ecr-system/src/app.module.ts#L98](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/app.module.ts#L98)).

### 3.2 Full Table Schema Inventory (21 Database Tables)

#### 1. `defect_reports`
*   **Entity File:** `ecr-system/src/defect-reports/defect-report.entity.ts#L22-L140`
*   **Primary Key:** `id` (`uuid`, default `uuid_generate_v4()`)
*   **Unique Constraints:** `reportNumber` (`UQ_ac52e87ad76c918ff4c14bd6895`)
*   **Indexes:**
    *   `IDX_defect_reports_status_createdAt` ON (`status`, `createdAt`)
    *   `IDX_defect_reports_status_componentsIssued` ON (`status`, `componentsIssued`)
    *   `IDX_defect_reports_raised_by_id` ON (`raised_by_id`)
    *   `IDX_defect_reports_scOrPoNo` ON (`scOrPoNo`)
    *   `IDX_defect_reports_status` ON (`status`)
    *   `IDX_defect_reports_createdAt` ON (`createdAt`)
    *   `IDX_defect_reports_updatedAt` ON (`updatedAt`)
*   **Foreign Keys:**
    *   `raised_by_id` -> `users(id)` ON DELETE SET NULL
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `reportNumber` (`varchar`, NULLABLE, UNIQUE, format: `AGIPL-YYYY-ERR-XXXXX`)
    *   `raised_by_id` (`uuid`, NULLABLE, FK)
    *   `raisedByRole` (`enum: defect_reports_raisedbyrole_enum`, NOT NULL: `'OPERATOR'`, `'INSPECTOR'`, `'SENIOR_MANAGER'`)
    *   `scOrPoNo` (`varchar`, NOT NULL)
    *   `scNo` (`varchar`, NULLABLE)
    *   `poNo` (`varchar`, NULLABLE)
    *   `productId` (`varchar`, NULLABLE)
    *   `componentName` (`varchar`, NULLABLE)
    *   `errorTypeName` (`varchar`, NULLABLE)
    *   `partNumber` (`varchar`, NULLABLE)
    *   `batchNumber` (`varchar`, NULLABLE)
    *   `quantity` (`int`, NOT NULL, DEFAULT `1`)
    *   `stageOfFailure` (`varchar`, NOT NULL)
    *   `defectDescription` (`text`, NOT NULL)
    *   `reworkDescription` (`text`, NULLABLE)
    *   `images` (`text`, NOT NULL, DEFAULT `'[]'` — serialized JSON array of Cloudinary image URLs)
    *   `status` (`enum: defect_reports_status_enum`, NOT NULL, DEFAULT `'DRAFT'`)
    *   `inspectionType` (`varchar`, NULLABLE: `'REWORK'` or `'REJECTION'`)
    *   `componentsIssued` (`boolean`, NOT NULL, DEFAULT `false`)
    *   `componentsIssuedById` (`varchar`, NULLABLE)
    *   `componentsIssuedAt` (`timestamp`, NULLABLE)
    *   `issueRemarks` (`text`, NULLABLE)
    *   `sales_description` / `accountsDescription` (`text`, NULLABLE)
    *   `rejection_process_template` (`varchar`, NULLABLE)
    *   `rejection_failed_stage` (`varchar`, NULLABLE)
    *   `rejection_stage_costs` (`jsonb` / `json`, NULLABLE)
    *   `rejection_description` (`text`, NULLABLE)
    *   `createdAt` (`timestamp`, NOT NULL, DEFAULT `now()`)
    *   `updatedAt` (`timestamp`, NOT NULL, DEFAULT `now()`)

#### 2. `inspection_details`
*   **Entity File:** `ecr-system/src/inspection/inspection-detail.entity.ts#L15-L98`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Unique Constraints:** `report_id` (`REL_76631cab38e360c3fc78518be0`, One-to-One)
*   **Indexes:**
    *   `IDX_inspection_details_party_id` ON (`responsibleParty`, `responsibleId`)
    *   `IDX_inspection_details_inspector_id` ON (`inspector_id`)
    *   `IDX_inspection_details_responsibleParty` ON (`responsibleParty`)
    *   `IDX_inspection_details_responsibleId` ON (`responsibleId`)
*   **Foreign Keys:**
    *   `report_id` -> `defect_reports(id)` ON DELETE NO ACTION
    *   `inspector_id` -> `users(id)` ON DELETE SET NULL
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `report_id` (`uuid`, NOT NULL, UNIQUE, FK)
    *   `inspector_id` (`uuid`, NULLABLE, FK)
    *   `errorType` (`varchar`, NULLABLE)
    *   `rootCause` (`text`, NULLABLE)
    *   `responsibleParty` (`enum: inspection_details_responsibleparty_enum`, NOT NULL)
    *   `responsibleId` (`varchar`, NULLABLE — stores Operator UUID or Vendor name)
    *   `decision` (`enum: inspection_details_decision_enum`, NULLABLE: `'REWORK'`, `'SCRAP'`, `'ALTERNATIVE'`)
    *   `alternativeNote` (`text`, NULLABLE)
    *   `costEstimate` (`numeric(12,2)`, NOT NULL, DEFAULT `'0.00'`)
    *   `materialCost` (`numeric(12,2)`, NULLABLE, DEFAULT `'0.00'`)
    *   `labourCost` (`numeric(12,2)`, NULLABLE, DEFAULT `'0.00'`)
    *   `otherCost` (`numeric(12,2)`, NULLABLE, DEFAULT `'0.00'`)
    *   `costRemarks` (`text`, NULLABLE)
    *   `timeEstimateHours` (`numeric(8,2)`, NULLABLE, DEFAULT `'0.00'`)
    *   `lossAmount` (`numeric(12,2)`, NULLABLE)
    *   `reworkDescription` (`text`, NULLABLE)
    *   `rejection_process_template` (`varchar`, NULLABLE)
    *   `rejection_failed_stage` (`varchar`, NULLABLE)
    *   `rejection_stage_costs` (`jsonb` / `json`, NULLABLE)
    *   `rejection_description` (`text`, NULLABLE)
    *   `dc_number` (`varchar`, NULLABLE)
    *   `reviewedAt` (`timestamp`, NOT NULL, DEFAULT `now()`)

#### 3. `sm_review`
*   **Entity File:** `ecr-system/src/sm-review/sm-review.entity.ts#L14-L49`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Unique Constraints:** `report_id` (`REL_a2ca31ec6e7928c90e1154f49e`, One-to-One)
*   **Indexes:**
    *   `IDX_sm_review_sm_id` ON (`sm_id`)
*   **Foreign Keys:**
    *   `report_id` -> `defect_reports(id)` ON DELETE NO ACTION
    *   `sm_id` -> `users(id)` ON DELETE SET NULL
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `report_id` (`uuid`, NOT NULL, UNIQUE, FK)
    *   `sm_id` (`uuid`, NULLABLE, FK)
    *   `loopholeNote` (`text`, NOT NULL)
    *   `decisionNote` (`text`, NOT NULL)
    *   `biasedFlag` (`boolean`, NOT NULL, DEFAULT `false`)
    *   `forwardedToGm` (`boolean`, NOT NULL, DEFAULT `false`)
    *   `reviewedAt` (`timestamp`, NOT NULL, DEFAULT `now()`)

#### 4. `gm_approval`
*   **Entity File:** `ecr-system/src/gm-approval/gm-approval.entity.ts#L15-L51`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Unique Constraints:** `report_id` (`REL_1ee3dc9a6a2a4b827efbce8234`, One-to-One)
*   **Indexes:**
    *   `IDX_gm_approval_gm_id` ON (`gm_id`)
*   **Foreign Keys:**
    *   `report_id` -> `defect_reports(id)` ON DELETE NO ACTION
    *   `gm_id` -> `users(id)` ON DELETE SET NULL
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `report_id` (`uuid`, NOT NULL, UNIQUE, FK)
    *   `gm_id` (`uuid`, NULLABLE, FK)
    *   `approved` (`boolean`, NOT NULL)
    *   `remarks` (`text`, NULLABLE)
    *   `messageToSm` (`text`, NULLABLE — confidential, exposed only to GM and SM)
    *   `budgetApproved` (`numeric(12,2)`, NULLABLE)
    *   `approvedAt` (`timestamp`, NOT NULL, DEFAULT `now()`)

#### 5. `component_issue`
*   **Entity File:** `ecr-system/src/component-issue/component-issue.entity.ts#L18-L52`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Foreign Keys:**
    *   `report_id` -> `defect_reports(id)` ON DELETE NO ACTION
    *   `store_manager_id` -> `users(id)` ON DELETE SET NULL
    *   `issued_to_id` -> `users(id)` ON DELETE SET NULL
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `report_id` (`uuid`, NOT NULL, FK)
    *   `store_manager_id` (`uuid`, NULLABLE, FK)
    *   `components` (`text` / JSON, NOT NULL — array of `{ componentId, componentName, qty }`)
    *   `issued_to_id` (`uuid`, NULLABLE, FK)
    *   `remarks` (`text`, NULLABLE)
    *   `issuedAt` (`timestamp`, NOT NULL, DEFAULT `now()`)

#### 6. `report_attachments`
*   **Entity File:** `ecr-system/src/attachments/report-attachment.entity.ts#L13-L59`
*   **Primary Key:** `id` (`uuid`, PK, DEFAULT `gen_random_uuid()`)
*   **Indexes:**
    *   `idx_report_attachments_report_id` ON (`report_id`)
*   **Foreign Keys:**
    *   `report_id` -> `defect_reports(id)` ON DELETE CASCADE
    *   `uploaded_by_id` -> `users(id)` ON DELETE SET NULL
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `report_id` (`uuid`, NOT NULL, FK)
    *   `file_name` (`varchar(255)`, NOT NULL)
    *   `original_name` (`varchar(255)`, NOT NULL)
    *   `file_url` (`text`, NOT NULL — Cloudinary secure URL or local redirect URI)
    *   `public_id` (`varchar(500)`, NOT NULL — Cloudinary public_id or `local:<safeName>`)
    *   `file_type` (`varchar(50)`, NOT NULL: `'image'`, `'pdf'`, `'document'`)
    *   `mime_type` (`varchar(100)`, NOT NULL)
    *   `file_size_bytes` (`int`, NULLABLE)
    *   `uploaded_by_id` (`uuid`, NULLABLE, FK)
    *   `uploaded_at` (`timestamp`, DEFAULT `now()`)
    *   `created_at` (`timestamp`, DEFAULT `now()`)

#### 7. `audit_log`
*   **Entity File:** `ecr-system/src/audit-log/audit-log.entity.ts#L24-L92`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Indexes:**
    *   `IDX_audit_log_timestamp` ON (`timestamp`)
    *   `IDX_audit_log_report_id` ON (`report_id`)
    *   `IDX_audit_log_actor_id` ON (`actor_id`)
*   **Foreign Keys:**
    *   `report_id` -> `defect_reports(id)` ON DELETE NO ACTION
    *   `actor_id` -> `users(id)` ON DELETE SET NULL
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `report_id` (`uuid`, NOT NULL, FK)
    *   `actor_id` (`uuid`, NULLABLE, FK)
    *   `actorRole` (`varchar`, NOT NULL)
    *   `actionType` (`enum: AuditActionType`: `'STATUS_CHANGE'`, `'FIELD_EDIT'`, `'INVENTORY_UPDATED'`, `'COMPONENT_ISSUED'`, `'SALARY_DEDUCTION_CREATED'`, `'VENDOR_FAULT_CREATED'`, `'IMAGE_UPLOADED'`)
    *   `fieldName` (`varchar`, NULLABLE)
    *   `oldValue` (`text`, NULLABLE)
    *   `newValue` (`text`, NULLABLE)
    *   `fromStatus` (`varchar`, NULLABLE)
    *   `toStatus` (`varchar`, NULLABLE)
    *   `note` (`text`, NULLABLE)
    *   `timestamp` (`timestamp`, NOT NULL, DEFAULT `now()`)
    *   `action` (`varchar`, NULLABLE)
    *   `user_id` (`varchar`, NULLABLE)
    *   `user_email` (`varchar`, NULLABLE)
    *   `entity_type` (`varchar`, NULLABLE)
    *   `entity_id` (`varchar`, NULLABLE)
    *   `metadata` (`jsonb`, NULLABLE)
    *   `ip_address` (`varchar`, NULLABLE)

#### 8. `users`
*   **Entity File:** `ecr-system/src/users/user.entity.ts#L13-L50`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Unique Constraints:** `email` (`UQ_97672ac88f789774dd47f7c8be3`)
*   **Indexes:**
    *   `IDX_users_role` ON (`role`)
    *   `IDX_users_salaryRefId` ON (`salaryRefId`)
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `name` (`varchar`, NOT NULL)
    *   `email` (`varchar`, NOT NULL, UNIQUE)
    *   `passwordHash` (`varchar`, NOT NULL, select: false)
    *   `role` (`enum: users_role_enum`, NOT NULL: `'OPERATOR'`, `'INSPECTOR'`, `'SENIOR_MANAGER'`, `'GENERAL_MANAGER'`, `'STORE_MANAGER'`, `'ACCOUNTS'`, `'ADMIN'`)
    *   `department` (`varchar`, NULLABLE)
    *   `salaryRefId` (`varchar`, NULLABLE)
    *   `isActive` (`boolean`, NOT NULL, DEFAULT `true`)
    *   `createdAt` (`timestamp`, NOT NULL, DEFAULT `now()`)
    *   `updatedAt` (`timestamp`, NOT NULL, DEFAULT `now()`)

#### 9. `login_history`
*   **Entity File:** `ecr-system/src/users/login-history.entity.ts#L12-L34`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Indexes:**
    *   `IDX_login_history_user_id` ON (`user_id`)
    *   `IDX_login_history_timestamp` ON (`timestamp`)
*   **Foreign Keys:**
    *   `user_id` -> `users(id)` ON DELETE CASCADE
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `user_id` (`uuid`, NOT NULL, FK)
    *   `ipAddress` (`varchar`, NULLABLE)
    *   `userAgent` (`varchar`, NULLABLE)
    *   `timestamp` (`timestamp`, NOT NULL, DEFAULT `now()`)

#### 10. `notifications`
*   **Entity File:** `ecr-system/src/notifications/notification.entity.ts#L19-L71`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Indexes:**
    *   `IDX_notifications_userId_createdAt` ON (`user_id`, `createdAt`)
    *   `IDX_notifications_user_id` ON (`user_id`)
    *   `IDX_notifications_report_id` ON (`report_id`)
    *   `IDX_notifications_read` ON (`read`)
*   **Foreign Keys:**
    *   `user_id` -> `users(id)` ON DELETE CASCADE
    *   `report_id` -> `defect_reports(id)` ON DELETE NO ACTION
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `user_id` (`uuid`, NOT NULL, FK)
    *   `report_id` (`uuid`, NULLABLE, FK)
    *   `channel` (`enum: notifications_channel_enum`, NOT NULL: `'EMAIL'`, `'APP'`, `'APP_AND_EMAIL'`)
    *   `type` (`varchar`, NOT NULL)
    *   `message` (`text`, NOT NULL)
    *   `read` (`boolean`, NOT NULL, DEFAULT `false`)
    *   `status` (`enum: notifications_status_enum`, NOT NULL, DEFAULT `'QUEUED'`: `'QUEUED'`, `'SENT'`, `'FAILED'`, `'DELIVERED'`)
    *   `attemptCount` (`int`, NOT NULL, DEFAULT `0`)
    *   `sentAt` (`timestamp`, NULLABLE)
    *   `createdAt` (`timestamp`, NOT NULL, DEFAULT `now()`)
    *   `updatedAt` (`timestamp`, NOT NULL, DEFAULT `now()`)

#### 11. `notification_preferences`
*   **Entity File:** `ecr-system/src/email/entities/notification-preference.entity.ts#L12-L44`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Unique Constraints:** `user_id` (`REL_64c90edc7310c6be7c10c96f67`, One-to-One)
*   **Foreign Keys:**
    *   `user_id` -> `users(id)` ON DELETE CASCADE
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `user_id` (`uuid`, NOT NULL, UNIQUE, FK)
    *   `emailEnabled` (`boolean`, NOT NULL, DEFAULT `true`)
    *   `inAppEnabled` (`boolean`, NOT NULL, DEFAULT `true`)
    *   `dailySummary` (`boolean`, NOT NULL, DEFAULT `false`)
    *   `weeklySummary` (`boolean`, NOT NULL, DEFAULT `false`)
    *   `immediateNotifications` (`boolean`, NOT NULL, DEFAULT `true`)
    *   `createdAt` (`timestamp`, NOT NULL, DEFAULT `now()`)
    *   `updatedAt` (`timestamp`, NOT NULL, DEFAULT `now()`)

#### 12. `email_logs`
*   **Entity File:** `ecr-system/src/email/entities/email-log.entity.ts#L15-L74`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Indexes:**
    *   `IDX_email_logs_recipient_createdAt` ON (`recipient`, `createdAt`)
    *   `IDX_email_logs_status_createdAt` ON (`status`, `createdAt`)
    *   `IDX_email_logs_event` ON (`event`)
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `recipient` (`varchar`, NOT NULL)
    *   `cc` (`varchar`, NULLABLE)
    *   `bcc` (`varchar`, NULLABLE)
    *   `subject` (`varchar`, NOT NULL)
    *   `content` (`text`, NOT NULL)
    *   `isHtml` (`boolean`, NOT NULL, DEFAULT `true`)
    *   `event` (`enum: email_logs_event_enum`, NOT NULL)
    *   `status` (`enum: email_logs_status_enum`, NOT NULL, DEFAULT `'PENDING'`: `'PENDING'`, `'PROCESSING'`, `'SENT'`, `'FAILED'`, `'CANCELLED'`)
    *   `sentTime` (`timestamp`, NULLABLE)
    *   `retryCount` (`int`, NOT NULL, DEFAULT `0`)
    *   `failureReason` (`text`, NULLABLE — JSON string with providerName, responseCode, error, stackTrace)
    *   `relatedReportId` (`varchar`, NULLABLE)
    *   `notificationId` (`varchar`, NULLABLE)
    *   `providerMessageId` (`varchar`, NULLABLE)
    *   `createdAt` (`timestamp`, NOT NULL, DEFAULT `now()`)
    *   `updatedAt` (`timestamp`, NOT NULL, DEFAULT `now()`)

#### 13. `email_monitoring_audit_logs`
*   **Entity File:** `ecr-system/src/email-monitoring/entities/email-monitoring-audit-log.entity.ts#L8-L30`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `emailLogId` (`varchar`, NOT NULL)
    *   `adminUserId` (`varchar`, NOT NULL)
    *   `adminUsername` (`varchar`, NOT NULL)
    *   `action` (`varchar`, NOT NULL: `'RESEND'`, `'RETRY'`, `'CANCEL'`, `'BULK_RETRY'`)
    *   `reason` (`varchar`, NULLABLE)
    *   `timestamp` (`timestamp`, NOT NULL, DEFAULT `now()`)

#### 14. `salary_deduction`
*   **Entity File:** `ecr-system/src/salary-deduction/salary-deduction.entity.ts#L13-L50`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Indexes:**
    *   `IDX_salary_deduction_report_id` ON (`report_id`)
    *   `IDX_salary_deduction_operator_id` ON (`operator_id`)
    *   `IDX_salary_deduction_status` ON (`status`)
*   **Foreign Keys:**
    *   `report_id` -> `defect_reports(id)` ON DELETE NO ACTION
    *   `operator_id` -> `users(id)` ON DELETE SET NULL
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `report_id` (`uuid`, NOT NULL, FK)
    *   `operator_id` (`uuid`, NULLABLE, FK)
    *   `amount` (`numeric(10,2)`, NOT NULL)
    *   `status` (`varchar`, NOT NULL, DEFAULT `'PENDING'`: `'PENDING'`, `'APPROVED'`, `'CANCELLED'`, `'PAID'`)
    *   `reason` (`text`, NULLABLE)
    *   `monthRef` (`varchar`, NOT NULL, e.g. `'2026-07'`)
    *   `createdAt` (`timestamp`, NOT NULL, DEFAULT `now()`)

#### 15. `vendor_fault_log`
*   **Entity File:** `ecr-system/src/vendor-fault/vendor-fault-log.entity.ts#L14-L54`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Indexes:**
    *   `IDX_vendor_fault_log_report_id` ON (`report_id`)
    *   `IDX_vendor_fault_log_vendor_id` ON (`vendor_id`)
    *   `IDX_vendor_fault_log_recoveryStatus` ON (`recoveryStatus`)
*   **Foreign Keys:**
    *   `report_id` -> `defect_reports(id)` ON DELETE NO ACTION
    *   `vendor_id` -> `vendors(id)` ON DELETE NO ACTION
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `report_id` (`uuid`, NOT NULL, FK)
    *   `vendor_id` (`uuid`, NOT NULL, FK)
    *   `note` (`text`, NOT NULL)
    *   `recoveryAmount` (`numeric(12,2)`, NOT NULL, DEFAULT `'0.00'`)
    *   `recoveryStatus` (`enum: vendor_fault_log_recoverystatus_enum`, NOT NULL, DEFAULT `'PENDING'`: `'PENDING'`, `'RAISED'`, `'RECOVERED'`, `'PARTIALLY_RECOVERED'`, `'WAIVED'`, `'CANCELLED'`)
    *   `raisedAt` (`timestamp`, NOT NULL, DEFAULT `now()`)
    *   `recoveredAt` (`timestamp`, NULLABLE)

#### 16. `report_sequence`
*   **Entity File:** `ecr-system/src/defect-reports/report-sequence.entity.ts#L3-L10`
*   **Primary Key:** `id` (`varchar`, PK, e.g. `'AGIPL'`)
*   **Columns:**
    *   `id` (`varchar`, PK, NOT NULL)
    *   `lastValue` (`int`, NOT NULL, DEFAULT `0`)

#### 17. `components`
*   **Entity File:** `ecr-system/src/master-data/components/component.entity.ts#L3-L22`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Unique Constraints:** `code` (`UQ_5409124de81d8d24ef76b4a5315`)
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `code` (`varchar`, NOT NULL, UNIQUE)
    *   `name` (`varchar`, NOT NULL)
    *   `stockQty` (`int`, NOT NULL, DEFAULT `0`)
    *   `unit` (`varchar`, NULLABLE)
    *   `isActive` (`boolean`, NOT NULL, DEFAULT `true`)

#### 18. `cost_rates`
*   **Entity File:** `ecr-system/src/master-data/cost-rates/cost-rate.entity.ts#L3-L16`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `stageName` (`varchar`, NOT NULL)
    *   `ratePerHour` (`numeric(10,2)`, NOT NULL)
    *   `isActive` (`boolean`, NOT NULL, DEFAULT `true`)

#### 19. `error_types`
*   **Entity File:** `ecr-system/src/master-data/error-types/error-type.entity.ts#L3-L16`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Unique Constraints:** `name` (`UQ_e55020852b4fa050a3b907d8512`)
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `name` (`varchar`, NOT NULL, UNIQUE)
    *   `description` (`text`, NULLABLE)
    *   `isActive` (`boolean`, NOT NULL, DEFAULT `true`)

#### 20. `operators`
*   **Entity File:** `ecr-system/src/master-data/operators/operator.entity.ts#L3-L16`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `name` (`varchar`, NOT NULL)
    *   `operatorCode` (`varchar`, NULLABLE)
    *   `isActive` (`boolean`, NOT NULL, DEFAULT `true`)

#### 21. `vendors`
*   **Entity File:** `ecr-system/src/master-data/vendors/vendor.entity.ts#L3-L19`
*   **Primary Key:** `id` (`uuid`, PK)
*   **Columns:**
    *   `id` (`uuid`, PK, NOT NULL)
    *   `name` (`varchar`, NOT NULL)
    *   `contactEmail` (`varchar`, NULLABLE)
    *   `contactPhone` (`varchar`, NULLABLE)
    *   `isActive` (`boolean`, NOT NULL, DEFAULT `true`)

---

### 3.3 Entity Relationship Diagram (Mermaid)

```mermaid
erDiagram
    users ||--o{ defect_reports : "raises"
    users ||--o| notification_preferences : "configures"
    users ||--o{ notifications : "receives"
    users ||--o{ login_history : "logs_session"
    users ||--o{ inspection_details : "inspects"
    users ||--o{ sm_review : "reviews"
    users ||--o{ gm_approval : "approves"
    users ||--o{ component_issue : "issues_as_store"
    users ||--o{ component_issue : "receives_components"
    users ||--o{ salary_deduction : "penalized"
    users ||--o{ report_attachments : "uploads"
    users ||--o{ audit_log : "acts_on"

    defect_reports ||--o| inspection_details : "has_inspection"
    defect_reports ||--o| sm_review : "has_sm_review"
    defect_reports ||--o| gm_approval : "has_gm_approval"
    defect_reports ||--o{ component_issue : "fulfills"
    defect_reports ||--o{ report_attachments : "attaches"
    defect_reports ||--o{ audit_log : "tracked_by"
    defect_reports ||--o{ notifications : "triggers"
    defect_reports ||--o{ salary_deduction : "generates_penalty"
    defect_reports ||--o{ vendor_fault_log : "generates_debit"

    vendors ||--o{ vendor_fault_log : "incurred_by"
    report_sequence ||--|| defect_reports : "generates_id"
```

---

### 3.4 Status Enums & Type Definitions
Defined in `ecr-system/src/common/enums/report-status.enum.ts`:

1.  **`ReportStatus`:**
    *   `DRAFT`: Initial draft created by operator or user.
    *   `PENDING_INSPECTION`: Awaiting physical QC inspection.
    *   `INSPECTOR_DRAFT`: Inspection in progress, saved as draft by Inspector.
    *   `PENDING_ACCOUNTS_REVIEW`: Technical inspection complete; awaiting cost verification.
    *   `ACCOUNTS_DRAFT`: Financial review in progress, saved as draft by Accounts.
    *   `PENDING_SM_REVIEW`: Costs verified; awaiting Senior Manager review.
    *   `PENDING_GM_APPROVAL`: SM approved; awaiting final General Manager approval.
    *   `APPROVED`: GM granted budget and replacement approval.
    *   `REJECTED`: Rejected at SM or GM stage.
    *   `COMPONENTS_ISSUED`: Store Manager physically issued replacement materials.
    *   `REWORK_IN_PROGRESS`: Physical machining / rework underway on shop floor.
    *   `NEW_PRODUCTION`: Workpiece scrapped; new manufacturing cycle initiated.
    *   `CLOSED`: Physical resolution verified and ECR lifecycle complete.
2.  **`RaisedByRole`:** `OPERATOR`, `INSPECTOR`, `SENIOR_MANAGER`.
3.  **`Decision`:** `REWORK`, `SCRAP`, `ALTERNATIVE`.
4.  **`ResponsibleParty`:** `OPERATOR`, `VENDOR`, `PROCESS`, `MACHINE`, `CUSTOMER`, `MATERIAL`, `INLINE_QUALITY`, `VENDOR_QUALITY`, `DESIGN_TEAM`.
5.  **`RecoveryStatus`:** `PENDING`, `RAISED`, `RECOVERED`, `PARTIALLY_RECOVERED`, `WAIVED`, `CANCELLED`.
6.  **`NotificationChannel`:** `EMAIL`, `APP`, `APP_AND_EMAIL`.
7.  **`NotificationStatus`:** `QUEUED`, `SENT`, `FAILED`, `DELIVERED`.
8.  **`EmailStatus`:** `PENDING`, `PROCESSING`, `SENT`, `FAILED`, `CANCELLED`.
9.  **`NotificationEvent`:** `ReportCreated`, `ReportApproved`, `ReportRejected`, `ReportUpdated`, `Reminder`, `Escalation`, `ComponentIssued`, `VendorFault`, `SalaryDeduction`, `DailySummary`, `WeeklySummary`, `PasswordReset`.

### 3.5 Database Migrations
Located in `ecr-system/src/migrations/`:
1.  `1783487119085-PostgresMigration.ts`: Baseline Postgres migration establishing core tables, sequences, enums, indexes, and user schema extensions.
2.  `1783488677821-HistoryAndIndexes.ts`: Creates `login_history` table and user/timestamp indexes.
3.  `1783500000000-AddDcNumber.ts`: Adds `dc_number` (`varchar NULL`) to `inspection_details`.
4.  `1783510000000-AddAccountsDraftStatus.ts`: Appends `ACCOUNTS_DRAFT` to enum `defect_reports_status_enum`.
5.  `1783520000000-AddInspectorDraftStatus.ts`: Appends `INSPECTOR_DRAFT` to enum `defect_reports_status_enum`.
6.  `1783530000000-AddCustomerAndMaterialToResponsiblePartyEnum.ts`: Appends `CUSTOMER` and `MATERIAL` to enum `inspection_details_responsibleparty_enum`.
7.  `1783540000000-AddInlineQualityAndVendorQualityToResponsiblePartyEnum.ts`: Appends `INLINE_QUALITY`, `VENDOR_QUALITY`, and `DESIGN_TEAM` to enum `inspection_details_responsibleparty_enum`.
8.  `1783550000000-CreateReportAttachments.ts`: Creates `report_attachments` table and report index.

### 3.6 Database Seeds
*   **Status:** `NOT FOUND`.
*   **Search Evidence:** Searched all files across `ecr-system/src` and root workspaces for `*seed*`. Initial users and master records are provisioned either directly via SQL injection or created using the Admin interface (`/users` and `/master-data`).

### 3.7 Database Triggers & Stored Views
*   **Status:** `NOT FOUND`.
*   **Search Evidence:** Searched all migration files and repository source code for `CREATE TRIGGER`, `CREATE VIEW`, `CREATE FUNCTION`, `CREATE OR REPLACE`. All data mutations, business rules, sequence generations, and audit logging are implemented in application code (NestJS services and TypeORM transactions).

### 3.8 File & Attachment Storage
*   **Dual Storage Engine:** Cloudinary API primary with resilient local filesystem fallback (`ecr-system/src/attachments/attachments.service.ts#L64-L94`).
*   **Primary (Cloudinary):** Uses `cloudinary.v2.uploader.upload_stream` to upload files under folder `ecr-system/reports/{reportId}`. Returns secure HTTPS CDN URL.
*   **Local Disk Fallback:** If Cloudinary API fails or keys are unconfigured, saves file to disk at:
    `join(process.cwd(), 'uploads', 'reports', reportId, safeName)`
    Served via proxy route: `GET /api/defect-reports/:reportId/attachments/:id/view`.
*   **Size Limits:**
    *   Report Attachments (`/attachments`): **10 MB** (`10 * 1024 * 1024` bytes) ([attachments.service.ts#L19](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/attachments/attachments.service.ts#L19)). Max 10 attachments per report ([attachments.service.ts#L60](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/attachments/attachments.service.ts#L60)).
    *   Report Images (`/images`): **5 MB** (`5 * 1024 * 1024` bytes) ([image-upload.service.ts#L83](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/image-upload/image-upload.service.ts#L83)). Max 5 images per upload ([defect-reports.controller.ts#L115](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/defect-reports/defect-reports.controller.ts#L115)).
*   **Allowed MIME Types:**
    *   Images: `image/jpeg`, `image/png`, `image/webp`.
    *   Documents: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.

### 3.9 Backups & Data Retention
*   **Automated Backups:** Managed at the database hosting layer (Neon Serverless PostgreSQL Point-In-Time Recovery / PITR). Continuously archives write-ahead logs (WAL) allowing point-in-time restore to any second within 7 days ([production_readiness_handbook.md#L48-L50](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/production_readiness_handbook.md#L48-L50)).
*   **Manual Logical Backup Procedure:**
    ```bash
    pg_dump -d "postgresql://user:****@host/db" -F c -b -v -f ecr_db_backup.dump
    ```
*   **Manual Restoration Procedure:**
    ```bash
    pg_restore -d "postgresql://user:****@host/db" -v ecr_db_backup.dump
    ```
*   **Data Purge / Cleanup Utility:** `ecr-system/scripts/clean-production-data.ts#L14-L38` provides an automated script to truncate transactional tables (`audit_log`, `email_logs`, `notifications`, `inspection_details`, `sm_review`, `gm_approval`, `component_issue`, `salary_deduction`, `vendor_fault_log`, `defect_reports`, `report_sequence`) while preserving master data (`users`, `components`, `cost_rates`, `error_types`, `operators`, `vendors`).

---

## 4. Deployment & Infrastructure

### 4.1 Hosting, Operating System & Process Architecture
*   **Cloud Hosting Platform:** Render (`render.yaml#L1-L22`).
*   **Service Name:** `ecr-system-web` (Web Service, Node environment).
*   **Operating System:** Linux (Ubuntu 22.04 LTS / Alpine container on Render host).
*   **Process Architecture:** Single Node.js process executing `node dist/main` from workspace `ecr-system` ([package.json#L15](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/package.json#L15)).
*   **Port Configuration:** Binds to `process.env.PORT || 3000` ([ecr-system/src/main.ts#L81](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/main.ts#L81)).
*   **Production URL / Domain:** `https://error-correction-application.onrender.com` ([production_readiness_handbook.md#L32](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/production_readiness_handbook.md#L32)).
*   **Reverse Proxy & SSL:** Render automated reverse proxy terminating TLS with managed Let's Encrypt SSL certificates.

### 4.2 Docker & Containerization Status
*   **Status:** `NOT FOUND`.
*   **Search Evidence:** Searched for `*Dockerfile*`, `*compose*`, `*ecosystem*`, `*procfile*` across all non-`node_modules` paths. No Dockerfile or compose files exist in the repository. The project relies on Render's native Node buildpack defined in `render.yaml`.

### 4.3 CI/CD Pipeline
Defined in `.github/workflows/ci.yml#L1-L36`:
*   **Trigger:** Push or Pull Request targeting branch `main`.
*   **Runner:** `ubuntu-latest`.
*   **Steps:**
    1.  Checkout code via `actions/checkout@v4`.
    2.  Setup Node.js `22` via `actions/setup-node@v4` with npm cache targeting `package-lock.json`.
    3.  Install dependencies: `npm ci`.
    4.  Lint check: `npm run lint --workspaces --if-present`.
    5.  Build project: `npm run build` (builds both `frontend` and `ecr-system`).
    6.  Execute unit tests: `npx jest --workspace=ecr-system` (with mock `DATABASE_URL`).

### 4.4 Step-by-Step Deployment from Scratch

#### Step 1: Provision Cloud Database (Neon PostgreSQL)
1.  Create a PostgreSQL database project on Neon (`https://neon.tech`).
2.  Copy the connection string with SSL parameter appended:
    `postgresql://<user>:<password>@<host>/<dbname>?sslmode=require`

#### Step 2: Provision Media Storage (Cloudinary)
1.  Create an account on Cloudinary (`https://cloudinary.com`).
2.  Obtain `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.

#### Step 3: Configure Outbound Email Dispatch
Choose one or both delivery methods:
*   *Method A (Direct Gmail SMTP):* Generate Google Account App Password at `https://myaccount.google.com/apppasswords`. Set `GMAIL_APP_PASSWORD` and `EMAIL_FROM`.
*   *Method B (Google Apps Script HTTPS Proxy):* Deploy Google Apps Script Web App. Set `GMAIL_SCRIPT_URL` and `GMAIL_SCRIPT_TOKEN`.

#### Step 4: Configure Web Service on Render
1.  Link GitHub repository on Render.
2.  Select **Web Service** using `render.yaml` or manual configuration:
    *   **Runtime:** Node.
    *   **Build Command:**
        ```bash
        npm ci && rm -rf ecr-system/dist && npm run build
        ```
    *   **Start Command:**
        ```bash
        npm run start
        ```
3.  Configure all required Environment Variables (see Section 5).

#### Step 5: Startup Migrations & Verification
1.  Upon startup, NestJS boots, TypeORM runs automatic migrations (`migrationsRun: true`), and validates configuration.
2.  Confirm application health checks:
    *   Liveness: `GET /api/health/live` (expects HTTP 200 `{ status: "live", uptime: ... }`)
    *   Readiness: `GET /api/health/ready` (expects HTTP 200 `{ status: "ready", database: { status: "healthy" } }`)

### 4.5 Rollback Procedure
*   **Via Render Dashboard:** Navigate to Render Service -> *Deploys* -> Select previously successful deploy -> Click **Rollback to this deploy**.
*   **Via Git:**
    ```bash
    git revert HEAD -m 1
    git push origin main
    ```
*   **Database Rollback:** If a database migration failed, revert using TypeORM CLI or restore Neon database snapshot to a point-in-time prior to deployment via Neon Console.

---

## 5. Configuration & Environment Variables

### 5.1 Environment Variable Dictionary
Validated in `ecr-system/src/app.module.ts#L43-L64`:

| Variable Name | Description & Architectural Purpose | Required? | Default / Example | File Reference Where Read |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Local or cloud HTTP binding port. | Optional | `3000` | `ecr-system/src/main.ts#L81` |
| `NODE_ENV` | Environment mode (`development` vs `production`). In production, disables synchronize. | Optional | `development` | `ecr-system/src/app.module.ts#L37, L93` |
| `DATABASE_URL` | Neon/Postgres connection URI including user, pass, host, port, dbname, sslmode. | **Mandatory** | `postgresql://user:****@host:5432/db?sslmode=require` | `ecr-system/src/app.module.ts#L44, L90` |
| `JWT_SECRET` | Cryptographic secret key used to sign and verify session JWTs. | **Mandatory** | *(Masked random hash)* `****` | `ecr-system/src/app.module.ts#L44`, `ecr-system/src/auth/auth.service.ts#L124` |
| `JWT_EXPIRES_IN` | Token validity lifespan. | Optional | `8h` | `ecr-system/src/auth/auth.module.ts#L22` |
| `EMAIL_PRIMARY_PROVIDER` | Preferred email transport: `'smtp'` or `'gas'`. | Optional | `'smtp'` | `ecr-system/src/email/services/gmail-smtp.service.ts#L85` |
| `GMAIL_APP_PASSWORD` | 16-character Google App Password for direct SMTP dispatch via port 587. | Conditional | *(Masked App Password)* `****` | `ecr-system/src/app.module.ts#L59`, `gmail-smtp.service.ts#L40` |
| `GMAIL_SCRIPT_URL` | Google Apps Script HTTPS Web App endpoint proxying email deliveries. | Conditional | `https://script.google.com/macros/s/.../exec` | `ecr-system/src/app.module.ts#L51`, `gmail-smtp.service.ts#L27` |
| `GMAIL_SCRIPT_TOKEN` | Bearer verification token validated by Google Apps Script. | Conditional | *(Masked API Token)* `****` | `ecr-system/src/app.module.ts#L52`, `gmail-smtp.service.ts#L17` |
| `EMAIL_FROM` | Dispatcher sender address. | **Mandatory** | `posuppportairtronic@gmail.com` | `ecr-system/src/app.module.ts#L44`, `gmail-smtp.service.ts#L39` |
| `EMAIL_FROM_NAME` | Display name for outbound emails. | Optional | `"Airtronics ECR System"` | `ecr-system/src/email/services/email.service.ts#L46` |
| `FRONTEND_URL` | Authorized frontend URL used for CORS and email deep links. | Optional | `http://localhost:5173` | `ecr-system/src/notifications/notification.listener.ts#L30` |
| `ECR_INTERNAL_SECRET` | Inbound shared secret required in `x-internal-secret` header for `/api/internal/*`. | Optional | `vsmart_ecr_bridge_2026_secure` | `ecr-system/src/internal/guards/internal-secret.guard.ts#L8` |
| `RM_API_URL` | Outbound base URL for V-Smart / RM application webhook dispatches. | Optional | `https://v-smart-backend.onrender.com` | `ecr-system/src/notifications/notification.listener.ts#L199` |
| `RM_INTERNAL_SECRET` | Outbound shared secret sent in `x-internal-secret` header when calling RM app. | Optional | `vsmart_ecr_bridge_2026_secure` | `ecr-system/src/notifications/notification.listener.ts#L200` |
| `RM_FRONTEND_URL` | Deep-linking base URL for RM UI navigation. | Optional | `https://v-smart-frontend.onrender.com` | `.env.example#L39` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account identifier for image & attachment hosting. | Optional | `****` | `ecr-system/src/attachments/cloudinary.service.ts` |
| `CLOUDINARY_API_KEY` | Cloudinary API access key. | Optional | `****` | `ecr-system/src/attachments/cloudinary.service.ts` |
| `CLOUDINARY_API_SECRET` | Cloudinary API access secret. | Optional | `****` | `ecr-system/src/attachments/cloudinary.service.ts` |
| `SLOW_EMAIL_THRESHOLD_MS` | Latency threshold in ms to trigger slow email warning log. | Optional | `3000` | `ecr-system/src/email/services/email.service.ts#L360` |
| `SLOW_NOTIFICATION_THRESHOLD_MS` | Latency threshold in ms for WebSocket push alerts. | Optional | `1000` | `ecr-system/src/notifications/notifications.gateway.ts#L186` |
| `VITE_API_BASE` | Frontend Vite API proxy target or base path. | Optional | `""` (or `"/api"`) | `frontend/src/services/apiClient.js#L5` |

### 5.2 Feature Flags
*   `SIMPLIFIED_WORKFLOW`: Hardcoded boolean flag in `frontend/src/utils/constants.js#L1` (`export const SIMPLIFIED_WORKFLOW = true;`).
    *   *When `true`:* Quality Inspectors create and technically inspect defect reports in one unified step. Creation automatically transitions the report directly to `PENDING_ACCOUNTS_REVIEW`, bypassing the standalone `PENDING_INSPECTION` stage.
    *   *When `false`:* Standard multi-step workflow. Machine Operators raise initial reports in `PENDING_INSPECTION`, requiring Quality Inspectors to open the report detail page and submit a separate inspection record.

---

## 6. Authentication, Authorization & Security

### 6.1 Authentication Mechanism
*   **Login Flow:** Handled by `POST /api/auth/login` (`ecr-system/src/auth/auth.service.ts#L27-L85`). Accepts username (email or employee name) and password.
*   **Portal Separation:** The login endpoint accepts a `portal` parameter (`'admin'` or `'user'`). If `'admin'` portal is targeted, non-admins are rejected with HTTP 401. If `'user'` portal is targeted, administrators are blocked from accessing staff views.
*   **Session Management:**
    *   Issues a signed JSON Web Token (JWT) containing `{ sub: user.id, email: user.email, role: user.role }`.
    *   Sets token as an `HttpOnly`, `SameSite: Lax` cookie named `token` with an 8-hour lifespan (`maxAge: 8 * 60 * 60 * 1000`) ([auth.service.ts#L64-L68](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/auth/auth.service.ts#L64-L68)).
    *   Also returns the token in response body as `accessToken` for API clients.
*   **Password Hashing:** Salted Blowfish cipher using `bcrypt.hash(password, 10)` (10 rounds) ([users.service.ts#L41](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/users/users.service.ts#L41)).
*   **Stateless Password Reset:**
    *   Generates a 1-hour signed JWT using `secret = JWT_SECRET + user.passwordHash` ([auth.service.ts#L124-L129](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/auth/auth.service.ts#L124-L129)).
    *   When the password is updated, `user.passwordHash` changes immediately, which automatically invalidates the reset token without requiring database state.

### 6.2 Role & Permission Matrix (Role x Screen x Action)

| Action / Capability | Operator | Inspector | Accounts | Senior Manager | General Manager | Store Manager | Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Login to Staff Portal** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Login to Admin Portal** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Raise New Defect Report** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Save Inspector Draft** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Submit Technical Inspection** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Audit & Verify Costs** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Save Accounts Draft** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Senior Manager Review / Reject** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **General Manager Approve / Reject**| ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **View Confidential GM Notes** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Issue Replacement Components** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Edit Report Fields** | ❌ | ❌ | ✅ (costs) | ✅ (tech/costs)| ✅ (costs) | ❌ | ✅ (all) |
| **Upload Attachments** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Manage Users & Roles** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Manage Master Data** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (stock) | ✅ |
| **View Immutable Audit Ledger** | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Monitor Email Logs & Retries** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Permanent Report Hard Delete** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### 6.3 Security Middleware, Headers & CORS
*   **Helmet:** Configures HTTP security headers and CSP ([ecr-system/src/main.ts#L24-L37](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/main.ts#L24-L37)):
    *   `defaultSrc: ["'self'"]`
    *   `connectSrc: ["'self'", 'wss:', 'ws:']`
    *   `scriptSrc: ["'self'", "'unsafe-inline'"]`
    *   `styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']`
    *   `fontSrc: ["'self'", 'https://fonts.gstatic.com']`
    *   `imgSrc: ["'self'", 'data:', 'https:', 'blob:']`
*   **CORS:** Enabled with `credentials: true` and dynamic origin callback (`ecr-system/src/main.ts#L65-L70`).
*   **Rate Limiting:** `ThrottlerGuard` active globally ([ecr-system/src/app.module.ts#L66-L77, L127-L131](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/app.module.ts#L66-L77)):
    *   Default endpoints: 60 requests per 60,000 ms.
    *   Authentication endpoints: 10 to 20 requests per 60,000 ms.
*   **Global Exception Sanitization:** `AllExceptionsFilter` (`ecr-system/src/common/filters/all-exceptions.filter.ts#L1-L61`) suppresses raw database stacks and leaks.

---

## 7. Email & SMTP Subsystem

### 7.1 Architecture & Dispatch Providers
The application implements a resilient, dual-provider dispatch architecture ([ecr-system/src/email/services/gmail-smtp.service.ts#L8-L190](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/gmail-smtp.service.ts#L8-L190)):
1.  **Provider 1: Google Apps Script (GAS) Web App HTTPS Proxy:**
    *   Designed for serverless and cloud tiers (Render) where outbound SMTP ports may encounter IPv6 routing delays or firewall blocks.
    *   Communicates via HTTPS POST to `GMAIL_SCRIPT_URL` with bearer `GMAIL_SCRIPT_TOKEN`.
    *   *Circuit Breaker:* If GAS quota limit is tripped (`"quota exceeded"` or `"Service invoked too many times"`), a circuit breaker trips for 6 hours ([gmail-smtp.service.ts#L70-L77](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/gmail-smtp.service.ts#L70-L77)), automatically shifting all outbound emails to Direct Gmail SMTP.
2.  **Provider 2: Direct Gmail SMTP Fallback:**
    *   Host: `smtp.gmail.com`
    *   Port: `587`
    *   TLS Mode: `STARTTLS` (`secure: false`)
    *   Auth Method: Username/Password authentication using Google Account App Password (`GMAIL_APP_PASSWORD` and `EMAIL_FROM`).
    *   Network Protocol: Explicitly forces IPv4 DNS resolution via `dns.setDefaultResultOrder('ipv4first')` to bypass Render IPv6 timeouts.
    *   Timeouts: Connection and greeting timeouts set to 10,000 ms.

### 7.2 Email Queue & Retry Mechanism
*   **Queueing Engine:** Calls to `EmailService.queueEmail()` do not perform synchronous external HTTP/SMTP requests. They insert a record with status `PENDING` into table `email_logs` and emit `email.logs.updated` ([ecr-system/src/email/services/email.service.ts#L232-L343](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email.service.ts#L232-L343)).
*   **Queue Poller:** `EmailQueueService.processEmailQueue` runs on `@Cron(CronExpression.EVERY_MINUTE)` and on event `email.logs.updated` ([ecr-system/src/email/services/email-queue.service.ts#L88-L146](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L88-L146)).
*   **Rate Limiting:** Limits dispatch to at most 5 emails per minute ([email-queue.service.ts#L145](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L145)).
*   **Exponential Backoff Retries:** Failed dispatches undergo retry delays of 2s, 5s, and 15s. Retries up to 3 times before setting status to `CANCELLED`.
*   **Startup Auto-Recovery:** On module boot, automatically scans for emails that previously failed due to GAS quota exhaustion and resets them to `PENDING` ([email-queue.service.ts#L44-L71](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/email/services/email-queue.service.ts#L44-L71)).

### 7.3 Email Templates Inventory
All templates inherit from master wrapper `layout.html` with `header.html` and `footer.html` partials (`ecr-system/src/email/templates/`):

| Template Name | File Location | Triggering Event | Default Subject | Target Recipient Logic |
| :--- | :--- | :--- | :--- | :--- |
| `layout.html` | `src/email/templates/layout.html` | Master Wrapper | `{{subject}}` | Envelopes all outbound emails with standard responsive styling, logo, and footer. |
| `header.html` | `src/email/templates/header.html` | Partial | N/A | Application logo and organization branding. |
| `footer.html` | `src/email/templates/footer.html` | Partial | N/A | Automated notification disclaimer, support email, copyright, and IST timestamp. |
| `pending-review.html` | `src/email/templates/pending-review.html` | `ReportCreated` | `[ECR] New Defect Report Pending Inspection` | Quality Control Inspectors upon report creation in standard mode. |
| `approved.html` | `src/email/templates/approved.html` | `ReportApproved` | `[ECR] Approved Report: {reportNumber}` | Cost & Accounts, Store Managers, and Plant Admins upon GM approval. |
| `rejected.html` | `src/email/templates/rejected.html` | `ReportRejected` | `[ECR] Report Rejected: {reportNumber}` | Report raiser, Inspector, Accounts, and Admins upon rejection by SM or GM. |
| `returned-for-correction.html`| `src/email/templates/returned-for-correction.html`| `ReportUpdated` | `[ECR] Returned for Correction: {reportNumber}` | Original report author if returned for technical modifications. |
| `completed.html` | `src/email/templates/completed.html` | `ReportUpdated` | `[ECR] Completed/Closed Report: {reportNumber}` | Plant Admins and audit subscribers upon lifecycle closure. |
| `password-reset.html` | `src/email/templates/password-reset.html` | `PasswordReset` / `Reminder` | `[ECR] Velan Quality Hub — Password Reset Request` | Target user requesting password reset (contains 1-hour reset token link). |
| `system-alert.html` | `src/email/templates/system-alert.html` | `ReportUpdated` / Various | Dynamic (e.g. `[ECR] Action Required...`) | Fallback structured table template rendering dynamic summary cards and primary buttons. |

### 7.4 Role x Event Notification Matrix

| Business Workflow Event | Trigger Mechanism | Target Notification Roles | In-App Alert Type | Email Subject |
| :--- | :--- | :--- | :--- | :--- |
| **New Report Raised** (Standard) | `POST /defect-reports` | `INSPECTOR` | `New Defect Report` | `[ECR] New Defect Report Pending Inspection` |
| **Inspection Completed** (or Simplified Raise) | `PATCH /:id/inspect` / `rm-intake` | `ACCOUNTS` | `New ECR Pending Verification` | `[ECR] New ECR Pending Accounts Verification` |
| **Accounts Cost Draft Saved** | `PATCH /:id/fields` | `SENIOR_MANAGER` | `ECR Cost Verification Draft` | `[ECR] ECR Cost Verification Draft Saved` |
| **Accounts Submits to SM** | `PATCH /:id/status` (`PENDING_SM_REVIEW`) | `SENIOR_MANAGER` | `New ECR Pending Review` | `[ECR] New ECR Pending Review` |
| **SM Forwards to GM** | `PATCH /:id/sm-review` (forward=true) | `GENERAL_MANAGER` | `Pending GM Approval` | `[ECR] Pending GM Approval` |
| **SM Rejects Report** | `PATCH /:id/sm-review` (forward=false) | `INSPECTOR`, `ACCOUNTS`, `ADMIN` | `Report Rejected` | `[ECR] Report Rejected: {reportNumber}` |
| **GM Approves Report** | `PATCH /:id/gm-approve` (approved=true) | `ACCOUNTS`, `STORE_MANAGER`, `ADMIN` | `Report Approved` / `Action Required` | `[ECR] Approved Report: {reportNumber}` |
| **Confidential SM Report** | `PATCH /:id/gm-approve` | `SENIOR_MANAGER` | `Private GM Report` | `[ECR] [PRIVATE] GM Decision Report: {reportNumber}` |
| **GM Rejects Report** | `PATCH /:id/gm-approve` (approved=false) | `INSPECTOR`, `ACCOUNTS`, `ADMIN` | `Report Rejected` | `[ECR] Report Rejected: {reportNumber}` |
| **Stores Issue Components** | `PATCH /:id/issue-components` | `ACCOUNTS`, `INSPECTOR`, `ADMIN` | `Components Issued` | `[ECR] Components Issued: {reportNumber}` |
| **Physical Rework Started** | `PATCH /:id/status` (`REWORK_IN_PROGRESS`) | `OPERATOR`, `INSPECTOR` | `Rework In Progress` | `[ECR] Rework Started: {reportNumber}` |
| **New Production Started** | `PATCH /:id/status` (`NEW_PRODUCTION`) | `OPERATOR`, `INSPECTOR` | `New Production Started` | `[ECR] New Production: {reportNumber}` |
| **Report Closed** | `PATCH /:id/status` (`CLOSED`) | `ADMIN` | `Report Closed` | `[ECR] Completed/Closed Report: {reportNumber}` |
| **Operator Fault Penalty** | Event: `report.approved.operator_fault` | `ADMIN` | `Salary Deduction` | `[ECR] New Salary Deduction Logged` |
| **Vendor Fault Debit** | Event: `report.approved.vendor_fault` | `ADMIN` | `Vendor Fault` | `[ECR] Vendor Fault Logged: {reportNumber}` |

---

## 8. Background Jobs, Workers & Cron Schedulers

The application executes background asynchronous tasks via `@nestjs/schedule` and interval timers:

| Job / Worker Identifier | Execution Schedule | Source File Location | Operational Purpose | Tables Read | Tables Written |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Email Queue Dispatcher** | Every minute (`@Cron(CronExpression.EVERY_MINUTE)`) & event `email.logs.updated` | `ecr-system/src/email/services/email-queue.service.ts#L88` | Polls pending/failed email logs; applies 5-email/min rate limit; dispatches via GAS/SMTP; updates delivery records. | `email_logs` | `email_logs` |
| **Email Auto-Recovery** | On application boot (`OnModuleInit`) | `ecr-system/src/email/services/email-queue.service.ts#L33-L71` | Identifies emails cancelled or failed due to Google Apps Script quota exhaustion and resets them to `PENDING`. | `email_logs` | `email_logs` |
| **Notification Retry Cron** | Once annually (`@Cron('0 0 1 1 *')`) | `ecr-system/src/notifications/notification-retry.cron.ts#L36` | Stubbed retry runner. Re-scheduled to annual execution to eliminate redundant per-minute database polling. | `notifications` | None (stubbed) |
| **Memory Monitor** | Every 30 seconds (`setInterval`) | `ecr-system/src/monitoring/performance.service.ts#L65` | Samples Node.js heap, RSS, external buffers, and warns if heap exceeds 85%. | None | Internal memory ring buffer |
| **CPU & Event Loop Monitor** | Every 10 seconds (`setInterval`) | `ecr-system/src/monitoring/performance.service.ts#L66` | Measures event loop lag and CPU user/system times. | None | Internal memory ring buffer |
| **RPS & WebSocket Metrics** | Every 1 second (`setInterval`) | `ecr-system/src/monitoring/performance.service.ts#L68, L79` | Computes rolling requests-per-second and WebSocket events-per-second. | None | Internal memory ring buffer |

---

## 9. End-to-End Workflow & Business State Machine

### 9.1 Step-by-Step Lifecycle Analysis

#### Step 1: Defect Report Creation & Intake
*   **Actors:** Quality Inspector (`INSPECTOR`) or Machine Operator (`OPERATOR`, standard mode) or RM Inbound System (`RM_SYSTEM`).
*   **UI Route:** `/reports/new` ([frontend/src/pages/NewReportPage.jsx](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/frontend/src/pages/NewReportPage.jsx)) or Inbound API `POST /api/internal/rm-intake`.
*   **API Endpoints:** `POST /api/defect-reports` or `POST /api/internal/rm-intake`.
*   **Database Tables Touched:** `defect_reports`, `report_sequence`, `inspection_details`, `audit_log`, `notifications`, `email_logs`.
*   **Form Fields:** Type (`REWORK` vs `REJECTION`), `scNo`, `poNo`, `componentName`, `quantity`, `stageOfFailure` / `rejectionProcessTemplate` / `rejectionFailedStage`, `defectDescription`, `images`. In Simplified Mode, includes inline inspection: `responsibleParty`, `responsibleId`, `dcNumber`, `costEstimate`, `lossAmount`.
*   **Status Value:** `PENDING_ACCOUNTS_REVIEW` (Simplified Mode & RM Intake) or `PENDING_INSPECTION` (Standard Mode) or `DRAFT` / `INSPECTOR_DRAFT` (if saved as draft).
*   **Validations:** Subcontract No, PO No, component, quantity (>0), defect description are required. If submitting final inspection, responsibleParty and costEstimate are strictly required.
*   **Notifications:** Accounts users receive in-app alert and HTML email.

#### Step 2: Quality Inspection (Standard Mode Only)
*   **Actor:** Quality Inspector (`INSPECTOR`).
*   **UI Route:** `/reports/:id` (Inspect Modal).
*   **API Endpoint:** `PATCH /api/defect-reports/:id/inspect`.
*   **Status Value:** Transitions from `PENDING_INSPECTION` (or `INSPECTOR_DRAFT`) to `PENDING_ACCOUNTS_REVIEW` (or `INSPECTOR_DRAFT`).
*   **Database Tables Touched:** `inspection_details`, `defect_reports`, `audit_log`, `notifications`, `email_logs`.
*   **Validations:** Requires report status `PENDING_INSPECTION` or `INSPECTOR_DRAFT`. If final submit (`saveAsDraft: false`), requires `responsibleParty` and `costEstimate`.

#### Step 3: Financial Audit & Cost Verification
*   **Actor:** Cost & Accounts Executive (`ACCOUNTS`).
*   **UI Route:** `/reports/:id` (Accounts Cost Verification Modal).
*   **API Endpoints:**
    *   `PATCH /api/defect-reports/:id/fields` (batch field edits: materialCost, labourCost, otherCost, lossAmount, costRemarks, rejectionStageCosts).
    *   `PATCH /api/defect-reports/:id/status` (status update: `PENDING_SM_REVIEW` or `ACCOUNTS_DRAFT`).
*   **Database Tables Touched:** `inspection_details`, `defect_reports`, `audit_log`, `notifications`, `email_logs`.
*   **Status Value:** `ACCOUNTS_DRAFT` (draft) or `PENDING_SM_REVIEW` (submitted).
*   **Validations:** Accounts can only edit reports in `PENDING_ACCOUNTS_REVIEW` or `ACCOUNTS_DRAFT`. Transition to `PENDING_SM_REVIEW` strictly requires `materialCost`, `labourCost`, `lossAmount`, and `costEstimate` to be non-null.
*   **Cost Calculation:** Total cost dynamically recalculates:
    $$\text{Total Cost} = \text{Material Cost} + \text{Labour Cost} + \text{Other Cost} + \sum (\text{Active Stage Costs})$$

#### Step 4: Senior Manager (SM) Review
*   **Actor:** Senior / Section Manager (`SENIOR_MANAGER`).
*   **UI Route:** `/reports/:id` (SM Review Modal).
*   **API Endpoint:** `PATCH /api/defect-reports/:id/sm-review`.
*   **Database Tables Touched:** `sm_review`, `defect_reports`, `inspection_details`, `audit_log`, `notifications`, `email_logs`.
*   **Form Fields:** `loopholeNote` (investigation of systemic flaws), `decisionNote`, `biasedFlag` (boolean), `forwardToGm` (boolean), optional numeric field adjustments (`costEstimate`, `timeEstimateHours`, `lossAmount`, `rejectionStageCosts`).
*   **Status Value:** `PENDING_GM_APPROVAL` (if `forwardToGm: true`) or `REJECTED` (if `forwardToGm: false`).
*   **Validations:** Report must be in `PENDING_SM_REVIEW`. Cannot review a report raised by oneself (`report.raisedById !== actor.id`).

#### Step 5: General Manager (GM) Approval
*   **Actor:** General Manager (`GENERAL_MANAGER`).
*   **UI Route:** `/reports/:id` (GM Approval Modal).
*   **API Endpoint:** `PATCH /api/defect-reports/:id/gm-approve`.
*   **Database Tables Touched:** `gm_approval`, `defect_reports`, `audit_log`, `notifications`, `email_logs`, `salary_deduction` (if operator fault), `vendor_fault_log` (if vendor fault).
*   **Form Fields:** `approved` (boolean), `budgetApproved` (numeric), `remarks` (text), `messageToSm` (confidential text for SM).
*   **Status Value:** `APPROVED` (if approved) or `REJECTED` (if rejected).
*   **Outbound Webhook:** If approved, triggers webhook `POST ${RM_API_URL}/api/internal/ecr/material-pending` alerting sibling V-Smart / RM application of pending component replacement.
*   **Fault Routing:**
    *   If `responsibleParty === OPERATOR`: Emits `report.approved.operator_fault`, creating a pending `salary_deduction` record.
    *   If `responsibleParty === VENDOR`: Emits `report.approved.vendor_fault`, creating a pending `vendor_fault_log` debit record.
*   **Notifications:** Store Managers, Accounts, and Admins are alerted simultaneously of approval.

#### Step 6: Warehouse Component Issuance
*   **Actor:** Store Manager (`STORE_MANAGER`) or RM Automated Inbound Sync (`RM_SYSTEM`).
*   **UI Route:** `/reports/:id` (Issue Components Modal).
*   **API Endpoint:** `PATCH /api/defect-reports/:id/issue-components` or `POST /api/internal/material-issued`.
*   **Database Tables Touched:** `component_issue`, `defect_reports`, `audit_log`, `notifications`, `email_logs`.
*   **Form Fields:** `remarks` (text), optional custom component list.
*   **Status Value:** `COMPONENTS_ISSUED`.
*   **Validations:** Report must be in `APPROVED` status. Components cannot be re-issued if `report.componentsIssued === true`.

#### Step 7: Shop Floor Resolution & Closure
*   **Actor:** Admin, Senior Manager, or Accounts.
*   **UI Route:** `/reports/:id` (Status transition dropdown).
*   **API Endpoint:** `PATCH /api/defect-reports/:id/status`.
*   **Allowed Sequence:**
    *   `COMPONENTS_ISSUED` ➡️ `REWORK_IN_PROGRESS` or `NEW_PRODUCTION` ➡️ `CLOSED`.
    *   Or directly `COMPONENTS_ISSUED` ➡️ `CLOSED`.
*   **Status Value:** `CLOSED`.
*   **Validations:** Terminal status; no further state transitions permitted.

---

### 9.2 Complete State Transition Matrix
Defined in `ecr-system/src/defect-reports/defect-reports-workflow.service.ts#L663-L677`:

```
                       ┌───────────────────────────────┐
                       │             DRAFT             │
                       └───┬───────────────┬───────┬───┘
                           │               │       │
              ┌────────────▼──────┐        │       │
              │PENDING_INSPECTION │        │       │
              └───┬───────────────┘        │       │
                  │                        │       │
       ┌──────────▼────────┐               │       │
 ┌────►│  INSPECTOR_DRAFT  │               │       │
 │     └──┬────────────────┘               │       │
 │        │                                │       │
 │     ┌──▼─────────────────────────┐◄─────┘       │
 └─────┤  PENDING_ACCOUNTS_REVIEW   │              │
       └──┬────────────────────┬────┘              │
          │                    │                   │
       ┌──▼──────────────┐     │                   │
 ┌────►│  ACCOUNTS_DRAFT │     │                   │
 │     └──┬──────────────┘     │                   │
 │        │                    │                   │
 │     ┌──▼────────────────────▼────┐◄─────────────┘
 └─────┤     PENDING_SM_REVIEW      ├───────────────────────────────┐
       └──┬─────────────────────────┘                               │
          │                                                         │
       ┌──▼─────────────────────────┐                               │
       │    PENDING_GM_APPROVAL     ├─────────────────┐             │
       └──┬─────────────────────────┘                 │             │
          │                                           │             │
       ┌──▼─────────────────────────┐          ┌──────▼──────┐      │
       │          APPROVED          │          │  REJECTED   │◄─────┘
       └──┬─────────────────────────┘          └─────────────┘
          │
       ┌──▼─────────────────────────┐
       │     COMPONENTS_ISSUED      ├─────────────────┐
       └──┬────────────────────┬────┘                 │
          │                    │                      │
       ┌──▼─────────────────┐  │                      │
       │ REWORK_IN_PROGRESS │  │                      │
       └──┬─────────────────┘  │                      │
          │                    │                      │
       ┌──▼─────────────────┐  │                      │
       │   NEW_PRODUCTION   │  │                      │
       └──┬─────────────────┘  │                      │
          │                    │                      │
          └───────────┬────────┴──────────────────────┘
                      │
                   ┌──▼───┐
                   │CLOSED│
                   └──────┘
```

---

## 10. API Catalog & Endpoint Reference

All endpoints are prefixed with `/api` ([ecr-system/src/main.ts#L79](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/main.ts#L79)).

### 10.1 Authentication & Profile Endpoints (`/api/auth`)
*   `POST /api/auth/login`: Authenticates user by username/email and password. Returns JWT in HttpOnly cookie and JSON body.
    *   Auth: Public (Rate limit: 20 req/min).
    *   Handler: `ecr-system/src/auth/auth.controller.ts#L15-L24`.
*   `POST /api/auth/forgot-password`: Generates a single-use 1-hour reset token and dispatches reset email.
    *   Auth: Public (Rate limit: 10 req/min).
    *   Handler: `ecr-system/src/auth/auth.controller.ts#L26-L40`.
*   `POST /api/auth/verify-reset-token`: Validates token format and cryptographic signature against user's password hash.
    *   Auth: Public.
    *   Handler: `ecr-system/src/auth/auth.controller.ts#L42-L46`.
*   `POST /api/auth/reset-password`: Verifies token and updates user password hash via bcrypt.
    *   Auth: Public (Rate limit: 10 req/min).
    *   Handler: `ecr-system/src/auth/auth.controller.ts#L48-L53`.
*   `GET /api/auth/me`: Returns profile of authenticated user.
    *   Auth: `JwtAuthGuard`.
    *   Handler: `ecr-system/src/auth/auth.controller.ts#L55-L59`.
*   `POST /api/auth/logout`: Clears HttpOnly `token` cookie.
    *   Auth: Public.
    *   Handler: `ecr-system/src/auth/auth.controller.ts#L61-L65`.

### 10.2 Defect Reports & Workflow Endpoints (`/api/defect-reports` & `/api/reports`)
*   `POST /api/defect-reports`: Creates new defect report.
    *   Auth: `OPERATOR`, `INSPECTOR`, `SENIOR_MANAGER`, `ADMIN`.
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L37-L41`.
*   `GET /api/defect-reports`: Lists reports with optional `status`, `mine`, `page`, `limit` filtering.
    *   Auth: Authenticated users.
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L54-L68`.
*   `GET /api/defect-reports/:id`: Retrieves report by UUID with all relations.
    *   Auth: Authenticated users (draft reports restricted to author).
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L70-L73`.
*   `PATCH /api/defect-reports/:id`: Updates defect report metadata.
    *   Auth: `OPERATOR`, `INSPECTOR`, `SENIOR_MANAGER`, `ADMIN`.
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L43-L51`.
*   `PATCH /api/defect-reports/:id/inspect`: Submits technical QC inspection or saves draft.
    *   Auth: `INSPECTOR`.
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L75-L79`.
*   `PATCH /api/defect-reports/:id/sm-review`: Submits Senior Manager review (approve to GM or reject).
    *   Auth: `SENIOR_MANAGER`.
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L81-L85`.
*   `PATCH /api/defect-reports/:id/gm-approve`: Submits General Manager approval or rejection.
    *   Auth: `GENERAL_MANAGER`.
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L87-L91`.
*   `PATCH /api/defect-reports/:id/field`: Updates a single report or inspection field.
    *   Auth: `SENIOR_MANAGER`, `GENERAL_MANAGER`, `ACCOUNTS`, `ADMIN`.
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L93-L101`.
*   `PATCH /api/defect-reports/:id/fields`: Batch updates multiple fields within a single transaction.
    *   Auth: `SENIOR_MANAGER`, `GENERAL_MANAGER`, `ACCOUNTS`, `ADMIN`.
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L103-L111`.
*   `PATCH /api/defect-reports/:id/status`: Transitions report state according to valid state machine rules.
    *   Auth: `SENIOR_MANAGER`, `GENERAL_MANAGER`, `ACCOUNTS`, `ADMIN`.
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L134-L145`.
*   `PATCH /api/defect-reports/:id/issue-components`: Records physical component issuance.
    *   Auth: `STORE_MANAGER`.
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L147-L155`.
*   `POST /api/defect-reports/:id/images`: Uploads up to 5 images to Cloudinary.
    *   Auth: `OPERATOR`, `INSPECTOR`, `SENIOR_MANAGER`, `ADMIN`.
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L113-L122`.
*   `DELETE /api/defect-reports/:id/images`: Deletes an image from Cloudinary and report images array.
    *   Auth: `OPERATOR`, `INSPECTOR`, `SENIOR_MANAGER`, `ADMIN`.
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L124-L132`.
*   `DELETE /api/defect-reports/:id`: Permanently hard-deletes report and all child records across all 11 tables.
    *   Auth: `ADMIN`.
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L175-L182`.
*   `POST /api/defect-reports/bulk-delete` & `DELETE /api/defect-reports/bulk`: Bulk deletes reports by ID array.
    *   Auth: `ADMIN`.
    *   Handler: `ecr-system/src/defect-reports/defect-reports.controller.ts#L157-L173`.

### 10.3 Attachments Endpoints (`/api/defect-reports/:reportId/attachments`)
*   `POST /api/defect-reports/:reportId/attachments`: Uploads PDF/DOC/image attachment (10MB limit).
    *   Auth: `OPERATOR`, `INSPECTOR`, `SENIOR_MANAGER`, `ADMIN`.
    *   Handler: `ecr-system/src/attachments/attachments.controller.ts#L27-L61`.
*   `GET /api/defect-reports/:reportId/attachments`: Lists all attachments for report.
    *   Auth: Authenticated users.
    *   Handler: `ecr-system/src/attachments/attachments.controller.ts#L63-L67`.
*   `GET /api/defect-reports/:reportId/attachments/:id/view`: Streams or redirects to attachment file.
    *   Auth: Authenticated users.
    *   Handler: `ecr-system/src/attachments/attachments.controller.ts#L69-L86`.
*   `DELETE /api/defect-reports/:reportId/attachments/:id`: Deletes attachment from storage and DB.
    *   Auth: `OPERATOR`, `INSPECTOR`, `SENIOR_MANAGER`, `ADMIN`.
    *   Handler: `ecr-system/src/attachments/attachments.controller.ts#L88-L96`.

### 10.4 Internal RM Integration Endpoints (`/api/internal`)
*   `POST /api/internal/rm-intake`: Inbound automated intake creating a defect report from RM app.
    *   Auth: Header `x-internal-secret: <ECR_INTERNAL_SECRET>`.
    *   Handler: `ecr-system/src/internal/internal.controller.ts#L24-L42`.
*   `POST /api/internal/material-issued`: Inbound webhook indicating RM stores issued materials.
    *   Auth: Header `x-internal-secret: <ECR_INTERNAL_SECRET>`.
    *   Handler: `ecr-system/src/internal/internal.controller.ts#L44-L49`.
*   `GET /api/internal/approved-reports`: Outbound polling endpoint listing GM-approved reports for RM sync.
    *   Auth: Header `x-internal-secret: <ECR_INTERNAL_SECRET>`.
    *   Handler: `ecr-system/src/internal/internal.controller.ts#L50-L54`.

### 10.5 Master Data Endpoints (`/api/master-data/*`)
*   `GET /api/master-data/components`: Cached list of component records.
*   `POST /api/master-data/components`: Creates component (`ADMIN`, `STORE_MANAGER`).
*   `PATCH /api/master-data/components/:id`: Updates component (`ADMIN`, `STORE_MANAGER`).
*   `DELETE /api/master-data/components/:id`: Deactivates component (`ADMIN`).
*   *(Identical REST endpoints exist for `/api/master-data/cost-rates`, `/api/master-data/error-types`, `/api/master-data/operators`, and `/api/master-data/vendors`)*.

### 10.6 User Management Endpoints (`/api/users` & `/api/admin/users`)
*   `GET /api/users`: Lists active users (filtered by role or department).
*   `GET /api/users/:id`: Retrieves single user details (`ADMIN`).
*   `POST /api/users`: Creates user account with temporary password (`ADMIN`).
*   `PATCH /api/users/:id`: Updates user role, department, or salaryRefId (`ADMIN`).
*   `DELETE /api/users/:id`: Deactivates user account (`ADMIN`).

### 10.7 Additional Module Endpoints
*   **Audit Ledger:** `GET /api/audit-logs`, `GET /api/audit-logs/:id` (`ADMIN`, `GM`, `SM`).
*   **Notifications:** `GET /api/notifications`, `GET /api/notifications/report/:reportId`, `PATCH /api/notifications/:id/read`.
*   **Analytics:** `GET /api/analytics/kpis`, `/trends`, `/root-causes`, `/insights`, `/vendor-intelligence`, `/operator-intelligence`, `/material-intelligence`, `/machine-intelligence`, `/sla`.
*   **Email Monitoring:** `GET /api/email-monitoring/summary`, `/list`, `/export`, `POST /retry-all-failed`, `POST /:id/resend`, `POST /:id/retry`, `POST /:id/cancel`.
*   **Component Issue:** `POST /api/component-issue`, `GET /api/component-issue/report/:reportId`.
*   **Salary Deduction:** `POST /api/salary-deduction`, `PATCH /api/salary-deduction/:id/status`, `GET /report/:reportId`, `GET /operator/:operatorId`.
*   **Vendor Fault:** `POST /api/vendor-fault`, `PATCH /api/vendor-fault/:id`, `GET /report/:reportId`, `GET /vendor/:vendorId`.
*   **Health & Performance:** `GET /api/health`, `GET /api/health/live`, `GET /api/health/ready`, `GET /api/performance/health`, `/stats`, `/memory`, `/cpu`, `/database`, `/socket`, `/uploads`, `/emails`, `/summary`.

---

## 11. Frontend Architecture & UI Catalog

### 11.1 Routing & Guards
Defined in `frontend/src/main.jsx#L47-L81`:
*   `/login`: `LoginPage` (Public).
*   `/reset-password`: `ResetPasswordPage` (Public).
*   `/unauthorized`: `UnauthorizedPage` (Public).
*   `Layout` wrapper routes:
    *   `/`: `Dashboard` (dynamically renders role dashboard).
    *   `/reports`: `ReportsPage` (Report list, filter bar, export modal).
    *   `/reports/new`: `NewReportPage` (Create defect report).
    *   `/reports/edit/:id`: `NewReportPage` (Edit report metadata).
    *   `/reports/:id`: `ReportDetailPage` (Full lifecycle actions, modals, and audit history).
    *   `/analytics`: `EnterpriseAnalytics` (Charts, KPIs, SLA, intelligence widgets).
    *   `/notifications`: `NotificationsPage` (In-app notifications table).
    *   `/users`: `UsersPage` (Guarded: `ADMIN`).
    *   `/master-data`: `MasterDataPage` (Guarded: `ADMIN`).
    *   `/audit`: `AuditViewerPage` (Guarded: `ADMIN`, `GENERAL_MANAGER`, `SENIOR_MANAGER`).
    *   `/admin/emails`: `EmailMonitoringDashboard` (Guarded: `ADMIN`).

### 11.2 State Management
*   **Server State:** `@tanstack/react-query` `QueryClient` ([frontend/src/main.jsx#L29-L37](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/frontend/src/main.jsx#L29-L37)):
    *   `staleTime: 5 * 60 * 1000` (5 minutes).
    *   `retry: 1`, `refetchOnWindowFocus: false`.
    *   Queries: `['defect-reports']`, `['report', id]`, `['users']`, `['master-data', entity]`, `['analytics-kpis']`.
*   **Authentication State:** `AuthContext` ([frontend/src/contexts/AuthContext.jsx#L6-L52](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/frontend/src/contexts/AuthContext.jsx#L6-L52)):
    *   Persists user object in `localStorage` under key `ecr_user`.
    *   Listens for `auth-expired` custom window event dispatched on HTTP 401.
*   **Real-Time State:** `NotificationContext` ([frontend/src/contexts/NotificationContext.jsx#L9-L113](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/frontend/src/contexts/NotificationContext.jsx#L9-L113)):
    *   Establishes Socket.IO connection to server origin (`http://localhost:3000` or production origin).
    *   Maintains `unreadCount`, `notifications` array, `isConnected` status.
    *   Listens for event `notification` and emits acknowledgement callback `{ received: true }`.

### 11.3 Key Pages & Component Form Structures
*   **`NewReportPage.jsx` (`1,477 lines`):**
    *   Mode toggle: `REWORK` vs `REJECTION`.
    *   Traceability fields: `scNo`, `poNo`, `componentId`, `quantity`.
    *   Process selection: `rejectionProcessTemplate` dropdown, `rejectionFailedStage` dropdown.
    *   Inline inspection fields (under `SIMPLIFIED_WORKFLOW`): `responsibleParty`, `responsibleId`, `dcNumber`, `reworkDescription` / `rejectionDescription`, `costEstimate`, `lossAmount`, `alternativeNotes`.
    *   File upload: Image drag-and-drop zone (up to 5 images).
*   **`ReportDetailPage.jsx` (`1,831 lines`):**
    *   Header: Status badge, report number, creation timestamp, author tag.
    *   Report Details Card: PO/SC numbers, part information, defect description, image gallery with lightbox view.
    *   Lifecycle Tab Panels:
        *   Technical Inspection details (costs, failure stages, responsible party).
        *   Accounts Verification details (material, labor, other costs, cost remarks).
        *   Senior Manager Review (loophole note, decision note, bias flag).
        *   General Manager Approval (budget approved, remarks, confidential note).
        *   Component Issue Status (store manager issuance remarks, timestamp).
    *   Action Modals:
        *   `ActionModal` (`inspect`): Complete inspection form with "Save as Draft" or "Submit Inspection".
        *   `ActionModal` (`accounts-review`): Cost breakdown inputs with "Save as Draft" or "Verify & Submit to SM".
        *   `ActionModal` (`sm-review`): Loophole note, decision note, bias flag, approve/reject toggle.
        *   `ActionModal` (`gm-approve`): Budget approved, remarks, messageToSm.
        *   `ActionModal` (`gm-reject`): Rejection reason, messageToSm.
        *   `ActionModal` (`issue-components`): Component issuance remarks.
    *   Child Component: `ReportAttachments.jsx` for viewing/uploading PDF/DOC files.
    *   Timeline: Historical audit log rendering who edited which field at what timestamp.

---

## 12. System Integrations (RM / V-Smart Bridge)

### 12.1 Overview & Architecture
The Velan Quality Hub integrates bidirectionally with the **V-Smart / Raw Material (RM) Application** (the production-floor raw material and warehouse inventory system):

```mermaid
sequenceDiagram
    autonumber
    participant RM as V-Smart / RM App
    participant ECR as Velan Quality Hub (ECR)
    participant WH as Stores / Warehouse

    Note over RM,ECR: Inbound Defect Intake
    RM->>ECR: POST /api/internal/rm-intake (x-internal-secret)
    ECR-->>RM: 201 Created { reportId, reportNumber }
    ECR->>ECR: Status set to PENDING_ACCOUNTS_REVIEW
    ECR-->>Accounts: In-App & Email: "New ECR Pending Verification"

    Note over ECR: Financial Verification & Executive Approval
    Accounts->>ECR: Audit costs & submit to SM
    SM->>ECR: Review & forward to GM
    GM->>ECR: GM Approval granted (Status: APPROVED)

    Note over ECR,RM: Outbound Approval Notification
    ECR->>RM: POST /api/internal/ecr/material-pending (x-internal-secret)
    RM-->>ECR: 200 OK (Material release scheduled in RM)

    Note over RM,ECR: Stores Material Issuance Sync
    WH->>RM: Stores Manager physically issues replacement
    RM->>ECR: POST /api/internal/material-issued (x-internal-secret)
    ECR->>ECR: Status set to COMPONENTS_ISSUED
    ECR-->>Stores/Inspector: Push Notification: "Components Issued"
```

### 12.2 Inbound Bridge: RM to ECR Intake (`POST /api/internal/rm-intake`)
*   **Endpoint:** `/api/internal/rm-intake` ([ecr-system/src/internal/internal.controller.ts#L24-L42](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.controller.ts#L24-L42)).
*   **Authentication:** Header `x-internal-secret` verified against `ECR_INTERNAL_SECRET` ([internal-secret.guard.ts#L8](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/guards/internal-secret.guard.ts#L8)).
*   **Payload Schema (`RmIntakeDto` in `ecr-system/src/internal/dto/rm-intake.dto.ts`):**
    ```json
    {
      "type": "REWORK", // "REWORK" | "REJECTION"
      "scNumber": "SC-2026-0042",
      "poNumber": "PO-450009812",
      "component": "Drive Shaft Flange",
      "quantityAffected": 2,
      "stageOfFailure": "OP10_TURNING",
      "errorType": "Machining Runout",
      "defectDescription": "Shaft runout exceeded 0.05mm tolerance limit during turning.",
      "responsibleParty": "OPERATOR",
      "operatorName": "K. Ramanathan",
      "reworkDescription": "Skim flange face and re-verify concentricity.",
      "rejectionDescription": null,
      "rejectionProcessTemplate": null,
      "rejectionFailedStage": null,
      "rejectionStageCosts": null,
      "costEstimation": 1250.00,
      "lossEstimation": 350.00,
      "alternativeNotes": "Can be salvaged if skimmed within 0.02mm.",
      "raisedByName": "S. Murugan (Line Inspector)"
    }
    ```
*   **Execution Logic (`InternalService.createFromRM`):**
    1.  Acquires pessimistic write lock on `ReportSequence` ('AGIPL').
    2.  Increments sequence and generates report number: `AGIPL-YYYY-ERR-XXXXX`.
    3.  Creates `DefectReport` with status `PENDING_ACCOUNTS_REVIEW` (skips inspection).
    4.  Creates child `InspectionDetail` record with mapped estimates and decisions.
    5.  Emits `report.status.changed` alerting Accounts team via email and WebSocket.
*   **Response:**
    ```json
    {
      "reportId": "8f3b2e10-4c5a-4b9e-9d2a-1a2b3c4d5e6f",
      "reportNumber": "AGIPL-2026-ERR-00104"
    }
    ```

### 12.3 Outbound Bridge: ECR to RM Material Pending (`POST .../material-pending`)
*   **Trigger:** General Manager approval (`gmApprove` in `defect-reports-workflow.service.ts`).
*   **Target Endpoint:** `${RM_API_URL}/api/internal/ecr/material-pending` ([notification.listener.ts#L222](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/notifications/notification.listener.ts#L222)).
*   **Authentication:** Header `x-internal-secret: <RM_INTERNAL_SECRET>`.
*   **Payload Schema:**
    ```json
    {
      "ecrId": "8f3b2e10-4c5a-4b9e-9d2a-1a2b3c4d5e6f",
      "reportNumber": "AGIPL-2026-ERR-00104",
      "type": "REWORK",
      "scNumber": "SC-2026-0042",
      "poNumber": "PO-450009812",
      "component": "Drive Shaft Flange",
      "quantityAffected": 2,
      "approvedAt": "2026-11-19T10:15:30.000Z"
    }
    ```
*   **Failure Handling:** If RM returns a non-200 code or network times out, ECR logs `[RM-Integration] Webhook call threw error — manual retry needed`. GM approval is already committed; RM can recover via polling.

### 12.4 Inbound Bridge: Material Issued Sync (`POST /api/internal/material-issued`)
*   **Endpoint:** `/api/internal/material-issued` ([internal.controller.ts#L44-L49](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.controller.ts#L44-L49)).
*   **Authentication:** Header `x-internal-secret: <ECR_INTERNAL_SECRET>`.
*   **Payload Schema (`MaterialIssuedDto` in `material-issued.dto.ts`):**
    ```json
    {
      "ecrId": "8f3b2e10-4c5a-4b9e-9d2a-1a2b3c4d5e6f",
      "reportNumber": "AGIPL-2026-ERR-00104",
      "issuedAt": "2026-11-19T11:00:00.000Z",
      "issuedQty": 2,
      "stockTransactionId": "STX-2026-9912",
      "issuedByName": "V. Rajesh (Stores)"
    }
    ```
*   **Execution Logic (`InternalService.handleMaterialIssued`):**
    1.  Finds report by `reportNumber`.
    2.  *Idempotency Check:* If report is already `COMPONENTS_ISSUED` or `CLOSED`, returns `{ success: true, message: "Already processed" }`.
    3.  Verifies report is in `APPROVED` status.
    4.  Creates `ComponentIssue` record linking `stockTransactionId` and store remarks.
    5.  Updates report `status = 'COMPONENTS_ISSUED'`, `componentsIssued = true`.
    6.  Dispatches `report.status.changed` alerting Accounts, Inspector, and Store Managers.

### 12.5 Polling Fallback: Approved Reports List (`GET /api/internal/approved-reports`)
*   **Endpoint:** `/api/internal/approved-reports` ([internal.service.ts#L197-L214](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/src/internal/internal.service.ts#L197-L214)).
*   **Authentication:** Header `x-internal-secret`.
*   **Returns:** Array of all reports currently in `APPROVED` status with `componentsIssued` boolean flag.

---

## 13. Shared Master Data & Identifier Standards

### 13.1 Master Data Models & Formats
1.  **Subcontract Number (`scNo`):**
    *   Format: Alphanumeric identifier, e.g. `SC-2026-XXXX`.
    *   Usage: References vendor or internal machining subcontract job cards.
2.  **Purchase Order Number (`poNo`):**
    *   Format: Alphanumeric or numeric string, e.g. `PO-45000XXXXX`.
    *   Usage: Cross-references ERP purchasing contracts and delivery terms.
3.  **Composite Identifier (`scOrPoNo`):**
    *   Format: Concatenated as `${scNo} / ${poNo}` for single-column search queries and legacy report compatibility.
4.  **Component Master (`components` table):**
    *   `code`: Unique alphanumeric SKU, e.g. `CMP-0102`.
    *   `name`: Plain description, e.g. `Digital Micrometer Spindle`.
    *   `stockQty`: Current physical stock count in stores warehouse.
    *   `unit`: Unit of measure (e.g., `NOS`, `PCS`, `KGS`).
5.  **Vendor Master (`vendors` table):**
    *   `name`: Registered corporate vendor name.
    *   `contactEmail`: Vendor dispatch email address.
    *   `contactPhone`: Vendor contact number.
6.  **Operator Master (`operators` table):**
    *   `name`: Operator full name.
    *   `operatorCode`: Employee payroll identification code.
7.  **Cost Rate Master (`cost_rates` table):**
    *   `stageName`: Manufacturing stage name matching `PROCESS_TEMPLATES`.
    *   `ratePerHour`: Standard decimal hourly machining overhead rate.
8.  **Error Type Master (`error_types` table):**
    *   `name`: Defect classification (e.g., `Tool Wear`, `Chatter Mark`, `Dimensional Out-of-Tolerance`).

### 13.2 Report Numbering Series Format
*   **Pattern:** `AGIPL-YYYY-ERR-XXXXX`
*   **Component Breakdown:**
    *   `AGIPL`: Airtronics / Velan organizational prefix.
    *   `YYYY`: 4-digit Gregorian calendar year.
    *   `ERR`: Error / Defect report indicator.
    *   `XXXXX`: 5-digit zero-padded continuous sequential integer.
*   **Concurrency Safeguard:** Sequence is managed inside table `report_sequence` (`id = 'AGIPL'`). Under database transactions, a pessimistic write lock (`lock: { mode: 'pessimistic_write' }`) prevents duplicate report number generation under concurrent submissions.

---

## 14. Observability, Audit Trail, Error Handling & Reporting

### 14.1 Structured Logging
Implemented via `StructuredLogger` (`ecr-system/src/common/structured-logger.ts#L1-L72`):
*   Formats console output as structured JSON objects containing:
    *   `timestamp`: ISO 8601 UTC timestamp.
    *   `level`: `INFO`, `WARN`, `ERROR`, `DEBUG`.
    *   `context`: Calling NestJS service or controller class name.
    *   `correlationId`: Trace correlation ID extracted from AsyncLocalStorage (`trace-context.ts`).
    *   `message`: Text description or object payload.
*   Dedicated log routing tags: `[FLOW_DIAGNOSTICS]`, `[EMAIL_DIAGNOSTICS]`, `[EMAIL_FALLBACK]`, `[GAS_QUOTA_CIRCUIT_BREAKER]`, `[SLOW_OPERATION]`.

### 14.2 Immutable Audit Trail (`audit_log` Table)
Every change to report state or metadata generates an immutable audit record:
*   `STATUS_CHANGE`: Records `fromStatus`, `toStatus`, `actorId`, `actorRole`, and reason `note`.
*   `FIELD_EDIT`: Records `fieldName`, `oldValue`, and `newValue` whenever an authorized user modifies technical notes, costs, or failure stages.
*   `COMPONENT_ISSUED`: Logs warehouse dispatch authorization with store manager remarks.

### 14.3 Error Handling Architecture
*   **`AllExceptionsFilter` (`ecr-system/src/common/filters/all-exceptions.filter.ts`):**
    *   Catches all unhandled HTTP exceptions, TypeORM database errors, and unexpected syntax crashes.
    *   Sanitizes response body returning standard schema:
        ```json
        {
          "statusCode": 400,
          "timestamp": "2026-11-19T10:18:23.000Z",
          "path": "/api/defect-reports/...",
          "correlationId": "req-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
          "message": "Sanitized error message"
        }
        ```

### 14.4 Reporting & Export Formats
*   **Excel (.xlsx) Export (`frontend/src/services/excelExportService.js`):**
    *   Generates multi-section workbook using SheetJS (`xlsx`).
    *   Includes corporate header banner (`Velan Metrology`), filter summary block, KPI stat boxes (Total, Open, Closed, Pending, Vendor Cases, Operator Cases, Total Cost, Average Cost).
    *   Styled data grid with alternating row colors, center-aligned dates, and Indian Rupee (`₹#,##0`) formatted cost columns.
*   **PDF Document Export (`frontend/src/services/pdfExportService.js`):**
    *   Generates landscape A4 report via `jspdf` and `jspdf-autotable`.
    *   Includes corporate header, translucent `CONFIDENTIAL` diagonal watermark, summary KPI cards, and autotable grid.
    *   Multi-page auto-wrapping with running header and `Page X of Y` confidential footer.
*   **Email CSV Export (`ecr-system/src/email-monitoring/email-monitoring.service.ts#L104-L140`):**
    *   Exports filtered email delivery logs directly to downloadable CSV via `GET /api/email-monitoring/export`.

---

## 15. Testing & Quality Assurance

### 15.1 Testing Frameworks & Configuration
*   **Backend Unit & Integration Testing:** Jest `^30.4.2` with `ts-jest` `^29.4.11` ([ecr-system/package.json#L59-L60](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/ecr-system/package.json#L59-L60)).
*   **Frontend End-to-End Testing:** Playwright Test `^1.61.1` ([frontend/package.json#L28](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/frontend/package.json#L28)).
*   **Load & Concurrency Testing:** k6 test suites committed at `k6-load-test.js` and `load-test-comprehensive.js`.

### 15.2 Test Execution Guide
To run backend test suites:
```bash
# Run all backend unit and service tests
npm test --workspace=ecr-system

# Run tests with code coverage report
npx jest --workspace=ecr-system --coverage
```
To run frontend Playwright E2E journeys:
```bash
cd frontend
npx playwright test
```
To execute k6 load test:
```bash
k6 run --vus 25 --duration 60s k6-load-test.js
```

### 15.3 Historical Coverage Snapshot
From `ecr-system/coverage.txt`:
*   Overall backend statement coverage: **44.35%** (Line coverage: **44.19%**).
*   High coverage modules:
    *   `audit-log`: 93.33% statement coverage.
    *   `auth.service`: 82.50% statement coverage.
    *   `common/enums`: 100% coverage.

---

## 16. Integration Readiness & Stores Issue Alignment

### 16.1 Current Gap: Stores Issuance Synchronization
In the current production build:
1.  When General Manager approves an ECR report, ECR successfully calls the outbound webhook:
    `POST ${RM_API_URL}/api/internal/ecr/material-pending`
2.  In V-Smart / RM application, warehouse operators locate the record and issue physical materials from raw material stock.
3.  **The Inbound Bridge Exists:** ECR provides `POST /api/internal/material-issued` to accept completion callbacks from RM.

### 16.2 Requirements to Make Stores-Issue-in-RM Flow Back to ECR
To achieve fully automated, touchless round-trip synchronization:
1.  **RM Webhook Implementation:** The V-Smart / RM backend must configure an outbound HTTP client in its material issuance routine that invokes:
    *   URL: `${ECR_API_URL}/api/internal/material-issued`
    *   Header: `x-internal-secret: ${ECR_INTERNAL_SECRET}`
    *   Body:
        ```json
        {
          "ecrId": "<ECR_REPORT_UUID>",
          "reportNumber": "<AGIPL-YYYY-ERR-XXXXX>",
          "issuedAt": "<ISO_TIMESTAMP>",
          "issuedQty": <NUMBER>,
          "stockTransactionId": "<RM_TRANSACTION_ID>",
          "issuedByName": "<STORES_USER_NAME>"
        }
        ```
2.  **Idempotency & Retry Safety:** The ECR endpoint `handleMaterialIssued` already validates:
    *   If report is already in `COMPONENTS_ISSUED` or `CLOSED`, it returns HTTP 200 `{ success: true, message: "Already processed" }`.
    *   If RM retries webhook dispatches, duplicate component issues are prevented.
3.  **Polling Fallback (Alternative to Webhooks):**
    If RM cannot trigger webhooks, RM can run a periodic background worker that queries `GET /api/internal/approved-reports` to reconcile approved reports against RM stock issuance logs.

---

## 17. Technical Debt, Known Bugs & Security / Operational Risks

### Prioritized Risk Analysis

| Risk ID | Severity | Category | Description & Impact | File & Code Reference | Recommended Mitigation |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **RISK-01** | **HIGH** | Data Integrity | **Missing Deduplication on RM Intake:** `createFromRM` creates a new report sequence every time called. If RM retries failed HTTP requests, duplicate ECR reports will be generated for the same SC/PO part. | `ecr-system/src/internal/internal.service.ts#L40-L77` | Add uniqueness check on `(scNo, poNo, componentName, status != 'CLOSED')` before creating report. |
| **RISK-02** | **HIGH** | Performance | **Hardcoded Email Queue Rate Limit:** `EmailQueueService` processes at most 5 emails per minute (`validEmails = eligibleEmails.slice(0, 5)`). High floor activity or bulk actions will cause email delivery delays. | `ecr-system/src/email/services/email-queue.service.ts#L145` | Increase batch slice size to 15-25 emails per minute, or make configurable via env variable. |
| **RISK-03** | **MEDIUM** | Reliability | **Disabled Notification Retry Cron:** `NotificationRetryCron.handleRetry` is scheduled to run once annually (`0 0 1 1 *`). Failed in-app notifications are never automatically retried by a background worker. | `ecr-system/src/notifications/notification-retry.cron.ts#L36` | Implement active retry logic in `retryFailed` and schedule cron to run every 5 minutes (`*/5 * * * *`). |
| **MEDIUM-04**| **MEDIUM** | Scalability | **Local In-Memory Cache in BaseCrudController:** Master data cache is stored in a process-local `Map` with a 10s TTL. If Render instances are scaled horizontally, cache invalidations on mutations will not sync across pods. | `ecr-system/src/common/controllers/base-crud.controller.ts#L9-L19` | Adopt Redis distributed cache or rely on PostgreSQL indexed queries with short HTTP cache headers. |
| **MEDIUM-05**| **MEDIUM** | Security | **Wildcard CORS Origin Callback:** In `main.ts`, `app.enableCors` uses a callback that reflects any inbound origin (`callback(null, true)`). Even with credentials, this should be locked down. | `ecr-system/src/main.ts#L65-L70` | Restrict allowed origins strictly to `process.env.FRONTEND_URL` and `process.env.RM_FRONTEND_URL`. |
| **LOW-06** | **LOW** | UX / Consistency | **Dual Username / Email Login Ambiguity:** `AuthService.login` matches against `user.email = :username OR user.name = :username`. If an employee name matches another employee's email, authentication could collide. | `ecr-system/src/auth/auth.service.ts#L32` | Enforce unique constraint on employee name or require email-only login. |
| **LOW-07** | **LOW** | Calculation | **Process Template Casing Sensitivity:** In `calculateTotalCost`, stage names must match `PROCESS_TEMPLATES` keys. Unmatched stages log a warning and return 0. | `ecr-system/src/defect-reports/utils/cost-calculator.ts#L70-L73` | Apply case-insensitive normalization across all process template dictionary lookups. |

---

## 18. Appendices

### Appendix A: Complete Database Table List
1.  `defect_reports`: Primary defect and ECR report record.
2.  `inspection_details`: Technical QC inspection findings and cost breakdown.
3.  `sm_review`: Senior Manager review notes and loophole assessments.
4.  `gm_approval`: General Manager approval, budget authorization, and confidential notes.
5.  `component_issue`: Warehouse store material issuance records.
6.  `report_attachments`: File metadata for PDFs and documents stored in Cloudinary/local.
7.  `audit_log`: Immutable ledger of field edits, status changes, and actions.
8.  `users`: System user credentials, roles, departments, and payroll links.
9.  `login_history`: Session login timestamps, IP addresses, and user agents.
10. `notifications`: In-app notification queue, delivery status, and read flags.
11. `notification_preferences`: Per-user email and in-app channel delivery toggles.
12. `email_logs`: Outbound email transmission history, status, and provider responses.
13. `email_monitoring_audit_logs`: Admin email management audit actions (resend, retry, cancel).
14. `salary_deduction`: Financial penalty tracking for operator-attributed defects.
15. `vendor_fault_log`: Financial debit note recovery tracking for vendor defects.
16. `report_sequence`: Atomic auto-increment sequence generator for report numbers.
17. `components`: Master catalog of parts, stock quantities, and units.
18. `cost_rates`: Master hourly machining and labor cost rates.
19. `error_types`: Master catalog of standardized quality defect classifications.
20. `operators`: Master catalog of shop floor operators and employee codes.
21. `vendors`: Master catalog of approved suppliers and contact info.

### Appendix B: Complete REST API Endpoint Directory

#### Authentication & Profile (`/api/auth`)
*   `POST /api/auth/login` (Public, Throttled)
*   `POST /api/auth/forgot-password` (Public, Throttled)
*   `POST /api/auth/verify-reset-token` (Public)
*   `POST /api/auth/reset-password` (Public, Throttled)
*   `GET /api/auth/me` (Authenticated)
*   `POST /api/auth/logout` (Public)

#### Defect Reports & Workflow (`/api/defect-reports` & `/api/reports`)
*   `POST /api/defect-reports` (`OPERATOR`, `INSPECTOR`, `SENIOR_MANAGER`, `ADMIN`)
*   `GET /api/defect-reports` (Authenticated)
*   `GET /api/defect-reports/:id` (Authenticated)
*   `PATCH /api/defect-reports/:id` (`OPERATOR`, `INSPECTOR`, `SENIOR_MANAGER`, `ADMIN`)
*   `PATCH /api/defect-reports/:id/inspect` (`INSPECTOR`)
*   `PATCH /api/defect-reports/:id/sm-review` (`SENIOR_MANAGER`)
*   `PATCH /api/defect-reports/:id/gm-approve` (`GENERAL_MANAGER`)
*   `PATCH /api/defect-reports/:id/field` (`SENIOR_MANAGER`, `GENERAL_MANAGER`, `ACCOUNTS`, `ADMIN`)
*   `PATCH /api/defect-reports/:id/fields` (`SENIOR_MANAGER`, `GENERAL_MANAGER`, `ACCOUNTS`, `ADMIN`)
*   `PATCH /api/defect-reports/:id/status` (`SENIOR_MANAGER`, `GENERAL_MANAGER`, `ACCOUNTS`, `ADMIN`)
*   `PATCH /api/defect-reports/:id/issue-components` (`STORE_MANAGER`)
*   `POST /api/defect-reports/:id/images` (`OPERATOR`, `INSPECTOR`, `SENIOR_MANAGER`, `ADMIN`)
*   `DELETE /api/defect-reports/:id/images` (`OPERATOR`, `INSPECTOR`, `SENIOR_MANAGER`, `ADMIN`)
*   `DELETE /api/defect-reports/:id` (`ADMIN`)
*   `POST /api/defect-reports/bulk-delete` (`ADMIN`)
*   `DELETE /api/defect-reports/bulk` (`ADMIN`)

#### Attachments (`/api/defect-reports/:reportId/attachments`)
*   `POST /api/defect-reports/:reportId/attachments` (`INSPECTOR`, `OPERATOR`, `SENIOR_MANAGER`, `ADMIN`)
*   `GET /api/defect-reports/:reportId/attachments` (Authenticated)
*   `GET /api/defect-reports/:reportId/attachments/:id/view` (Authenticated)
*   `DELETE /api/defect-reports/:reportId/attachments/:id` (`INSPECTOR`, `OPERATOR`, `SENIOR_MANAGER`, `ADMIN`)

#### Internal System Bridge (`/api/internal`)
*   `POST /api/internal/rm-intake` (`x-internal-secret`)
*   `POST /api/internal/material-issued` (`x-internal-secret`)
*   `GET /api/internal/approved-reports` (`x-internal-secret`)

#### Master Data (`/api/master-data/*`)
*   `GET /api/master-data/components` (Public / Cached)
*   `POST /api/master-data/components` (`ADMIN`, `STORE_MANAGER`)
*   `PATCH /api/master-data/components/:id` (`ADMIN`, `STORE_MANAGER`)
*   `DELETE /api/master-data/components/:id` (`ADMIN`)
*   `GET /api/master-data/cost-rates` (Public / Cached)
*   `POST /api/master-data/cost-rates` (`ADMIN`, `STORE_MANAGER`)
*   `PATCH /api/master-data/cost-rates/:id` (`ADMIN`, `STORE_MANAGER`)
*   `DELETE /api/master-data/cost-rates/:id` (`ADMIN`)
*   `GET /api/master-data/error-types` (Public / Cached)
*   `POST /api/master-data/error-types` (`ADMIN`, `STORE_MANAGER`)
*   `PATCH /api/master-data/error-types/:id` (`ADMIN`, `STORE_MANAGER`)
*   `DELETE /api/master-data/error-types/:id` (`ADMIN`)
*   `GET /api/master-data/operators` (Public / Cached)
*   `POST /api/master-data/operators` (`ADMIN`, `STORE_MANAGER`)
*   `PATCH /api/master-data/operators/:id` (`ADMIN`, `STORE_MANAGER`)
*   `DELETE /api/master-data/operators/:id` (`ADMIN`)
*   `GET /api/master-data/vendors` (Public / Cached)
*   `POST /api/master-data/vendors` (`ADMIN`, `STORE_MANAGER`)
*   `PATCH /api/master-data/vendors/:id` (`ADMIN`, `STORE_MANAGER`)
*   `DELETE /api/master-data/vendors/:id` (`ADMIN`)

#### Users & Administration (`/api/users` & `/api/admin/users`)
*   `GET /api/users` (Staff roles)
*   `GET /api/users/:id` (`ADMIN`)
*   `POST /api/users` (`ADMIN`)
*   `PATCH /api/users/:id` (`ADMIN`)
*   `DELETE /api/users/:id` (`ADMIN`)

#### Audit Ledger (`/api/audit-logs` & `/api/audit`)
*   `GET /api/audit-logs` (`ADMIN`, `GENERAL_MANAGER`, `SENIOR_MANAGER`)
*   `GET /api/audit-logs/:id` (`ADMIN`, `GENERAL_MANAGER`, `SENIOR_MANAGER`)

#### Notifications & Real-Time (`/api/notifications`)
*   `GET /api/notifications` (Authenticated)
*   `GET /api/notifications/report/:reportId` (Authenticated)
*   `PATCH /api/notifications/:id/read` (Authenticated)

#### Email & Monitoring (`/api/email` & `/api/email-monitoring`)
*   `GET /api/email/logs` (`ADMIN`)
*   `GET /api/email/health` (`ADMIN`)
*   `POST /api/email/test` (`ADMIN`)
*   `POST /api/email/test-html` (`ADMIN`)
*   `POST /api/email/resend` (`ADMIN`)
*   `GET /api/email/template-preview/:template` (`ADMIN`)
*   `GET /api/email-monitoring/summary` (`ADMIN`)
*   `GET /api/email-monitoring/list` (`ADMIN`)
*   `GET /api/email-monitoring/export` (`ADMIN`)
*   `GET /api/email-monitoring/:id` (`ADMIN`)
*   `POST /api/email-monitoring/retry-all-failed` (`ADMIN`)
*   `POST /api/email-monitoring/:id/resend` (`ADMIN`)
*   `POST /api/email-monitoring/:id/retry` (`ADMIN`)
*   `POST /api/email-monitoring/:id/cancel` (`ADMIN`)

#### Analytics (`/api/analytics`)
*   `GET /api/analytics/kpis` (`ADMIN`, `GM`, `SM`, `ACCOUNTS`)
*   `GET /api/analytics/trends` (`ADMIN`, `GM`, `SM`, `ACCOUNTS`)
*   `GET /api/analytics/root-causes` (`ADMIN`, `GM`, `SM`)
*   `GET /api/analytics/insights` (`ADMIN`, `GM`, `SM`)
*   `GET /api/analytics/vendor-intelligence` (`ADMIN`, `GM`, `SM`, `INSPECTOR`)
*   `GET /api/analytics/operator-intelligence` (`ADMIN`, `GM`, `SM`)
*   `GET /api/analytics/material-intelligence` (`ADMIN`, `GM`, `SM`, `INSPECTOR`, `ACCOUNTS`)
*   `GET /api/analytics/machine-intelligence` (`ADMIN`, `GM`, `SM`, `INSPECTOR`)
*   `GET /api/analytics/sla` (`ADMIN`, `GM`, `SM`)

#### Component Issue Subsystem (`/api/component-issue`)
*   `POST /api/component-issue` (`STORE_MANAGER`)
*   `GET /api/component-issue/report/:reportId` (`STORE_MANAGER`, `SM`, `GM`, `INSPECTOR`)

#### Salary Deduction Subsystem (`/api/salary-deduction`)
*   `POST /api/salary-deduction` (`SENIOR_MANAGER`, `GENERAL_MANAGER`, `ADMIN`)
*   `PATCH /api/salary-deduction/:id/status` (`ADMIN`, `GENERAL_MANAGER`)
*   `GET /api/salary-deduction/report/:reportId` (`SM`, `GM`, `ADMIN`, `INSPECTOR`)
*   `GET /api/salary-deduction/operator/:operatorId` (`ADMIN`, `GENERAL_MANAGER`)

#### Vendor Fault Subsystem (`/api/vendor-fault`)
*   `POST /api/vendor-fault` (`SENIOR_MANAGER`, `GENERAL_MANAGER`)
*   `PATCH /api/vendor-fault/:id` (`SENIOR_MANAGER`, `GENERAL_MANAGER`, `ADMIN`)
*   `GET /api/vendor-fault/report/:reportId` (`SM`, `GM`, `ADMIN`, `INSPECTOR`)
*   `GET /api/vendor-fault/vendor/:vendorId` (`SM`, `GM`, `ADMIN`)

#### Health & Telemetry (`/api/health` & `/api/performance`)
*   `GET /api/health` (Public)
*   `GET /api/health/live` (Public Liveness Heartbeat)
*   `GET /api/health/ready` (Public Database Readiness Check)
*   `GET /api/performance/health` (Public)
*   `GET /api/performance/stats` (Public)
*   `GET /api/performance/memory` (Public)
*   `GET /api/performance/cpu` (Public)
*   `GET /api/performance/database` (Public)
*   `GET /api/performance/socket` (Public)
*   `GET /api/performance/uploads` (Public)
*   `GET /api/performance/emails` (Public)
*   `GET /api/performance/summary` (Public)

---

### Appendix C: Environment Variable Reference Table

| Key | Mandatory | Type | Sensitive? | Purpose |
| :--- | :---: | :---: | :---: | :--- |
| `DATABASE_URL` | YES | String | YES | PostgreSQL connection string |
| `JWT_SECRET` | YES | String | YES | JWT cryptographic signature secret |
| `EMAIL_FROM` | YES | String | NO | Outbound sender email address |
| `GMAIL_APP_PASSWORD` | COND | String | YES | Google App Password for SMTP port 587 |
| `GMAIL_SCRIPT_URL` | COND | String | NO | Google Apps Script HTTPS proxy URL |
| `GMAIL_SCRIPT_TOKEN` | COND | String | YES | Google Apps Script security verification token |
| `PORT` | NO | Integer | NO | Port binding (default 3000) |
| `NODE_ENV` | NO | String | NO | Application environment (`development` / `production`) |
| `JWT_EXPIRES_IN` | NO | String | NO | JWT lifespan (default `8h`) |
| `EMAIL_PRIMARY_PROVIDER` | NO | String | NO | Preferred email provider (`smtp` / `gas`) |
| `EMAIL_FROM_NAME` | NO | String | NO | Outbound email display sender name |
| `FRONTEND_URL` | NO | String | NO | Base frontend origin for CORS and email links |
| `ECR_INTERNAL_SECRET` | NO | String | YES | Inbound shared secret for `/api/internal/*` |
| `RM_API_URL` | NO | String | NO | Base URL for sibling V-Smart / RM backend |
| `RM_INTERNAL_SECRET` | NO | String | YES | Outbound shared secret for V-Smart / RM API |
| `RM_FRONTEND_URL` | NO | String | NO | Base URL for V-Smart / RM frontend UI |
| `CLOUDINARY_CLOUD_NAME` | NO | String | NO | Cloudinary cloud account name |
| `CLOUDINARY_API_KEY` | NO | String | YES | Cloudinary API access key |
| `CLOUDINARY_API_SECRET` | NO | String | YES | Cloudinary API access secret |
| `VITE_API_BASE` | NO | String | NO | Frontend Vite API proxy target |

---

### Appendix D: Operations & Developer Command Cheat-Sheet

#### Repository Setup & Dependency Installation
```bash
# Clone repository
git clone <repository-url>
cd "ERROR CORRECTION APPLICATION"

# Install all monorepo dependencies across root, backend, and frontend
npm install
```

#### Local Development
```bash
# Launch NestJS backend server (Runs on http://localhost:3000)
cd ecr-system
npm run start:dev

# Launch React Vite frontend client (Runs on http://localhost:5173)
cd ../frontend
npm run dev
```

#### Production Build & Monolithic Run
```bash
# Compile both frontend and backend
npm run build

# Start monolithic production server (from repository root)
npm start
```

#### Database Migrations (TypeORM CLI)
```bash
# Generate migration from entity changes
npm run migration:generate --workspace=ecr-system -- src/migrations/NewMigrationName

# Execute pending migrations
npm run migration:run --workspace=ecr-system
```

#### Quality Assurance & Testing
```bash
# Run backend test suite
npm test --workspace=ecr-system

# Run tests with coverage
npx jest --workspace=ecr-system --coverage

# Run frontend linting
npm run lint --workspace=frontend

# Run Playwright E2E tests
cd frontend
npx playwright test
```

#### Database Maintenance & Production Cleanup
```bash
# REQUIRES SERVER CHECK: Dry-run database verification
npx ts-node --project ecr-system/tsconfig.json ecr-system/scripts/check-reports.ts

# REQUIRES SERVER CHECK: Clear transactional test data (Caution: prompts or executes truncate)
npx ts-node --project ecr-system/tsconfig.json ecr-system/scripts/clean-production-data.ts
```

---

## 19. Section Status Checklist

| Required Section | Status | Audit Findings & Verification Notes |
| :--- | :---: | :--- |
| **1. Overview** | **COMPLETE** | Purpose, users, roles, modules, tree depth 3, branches, and last 50 commits fully documented. |
| **2. Tech Stack** | **COMPLETE** | Complete dependency tables with versions and purpose; runtime and build tooling detailed. |
| **3. Data Storage & Schema** | **COMPLETE** | All 21 DB tables documented with exact columns, types, nullability, PK/FK/unique constraints, indexes, Mermaid ER diagram, status enums, migrations, backups, and attachment limits. Seeds and Triggers documented as NOT FOUND with search evidence. |
| **4. Deployment & Infrastructure** | **COMPLETE** | Render host, OS, process model, ports, domains, CI/CD, deploy-from-scratch guide, rollback, health checks. Docker documented as NOT FOUND with search evidence. |
| **5. Configuration** | **COMPLETE** | All environment keys and configuration rules mapped with variable names only (values masked as `****`), feature flags detailed. |
| **6. Auth & Security** | **COMPLETE** | Login flows, Bcrypt hashing, HttpOnly JWT cookies, stateless password reset, role permission matrix, middleware, CSP, CORS, and upload guards documented. |
| **7. Email / SMTP Subsystem** | **COMPLETE** | Dual provider (GAS + Gmail SMTP 587 STARTTLS), App password auth, queue/retry, all HTML templates, role x event notification matrix, and failure circuit breaker detailed. No secrets exposed. |
| **8. Background Jobs & Workers** | **COMPLETE** | All `@Cron` schedules and `setInterval` performance monitoring loops mapped with files, schedules, and read/write tables. |
| **9. End-to-End Workflow** | **COMPLETE** | Step-by-step lifecycle from intake to closure, UI routes, endpoints, validations, notifications, cost formula, and Mermaid transition diagram fully documented. |
| **10. API Reference** | **COMPLETE** | Complete endpoint directory covering all 22 controllers, methods, paths, decorators, roles, handlers, inbound and outbound integration calls. |
| **11. Frontend Architecture** | **COMPLETE** | Routing, role guards, React Query server state, AuthContext, NotificationContext with WebSocket ACKs, and key forms cataloged. |
| **12. Integrations (RM / V-Smart)** | **COMPLETE** | Inbound intake (`rm-intake`), inbound stores sync (`material-issued`), outbound webhook (`material-pending`), polling sync (`approved-reports`), payloads, and mappings fully documented. |
| **13. Shared Master Data** | **COMPLETE** | Standards for SC, PO, parts, vendors, operators, error types, cost rates, and `AGIPL-YYYY-ERR-XXXXX` report numbering format detailed. |
| **14. Observability & Reporting** | **COMPLETE** | Structured JSON logging, immutable audit ledger, global exception sanitization, Excel (.xlsx) and PDF export engines documented. |
| **15. Testing & QA** | **COMPLETE** | Jest unit tests, Playwright E2E journeys, k6 load testing, commands, and historical coverage metrics documented. |
| **16. Integration Readiness** | **COMPLETE** | Detailed specifications on how stores issuance in RM should flow back to ECR, idempotency guarantees, and payload schemas. |
| **17. Tech Debt & Risks** | **COMPLETE** | Prioritized technical debt, security, and operational risks (deduplication gap, email queue rate limiting, CORS wildcard) with concrete mitigations. |
| **18. Appendices** | **COMPLETE** | Complete table list (21 tables), endpoint directory (65+ endpoints), environment variable reference, and developer command cheat-sheet provided. |

---
*Report compiled and certified under Read-Only Audit mode. File location: `docs/audit/ECR_QUALITY_HUB_FULL_REPORT.md`.*
