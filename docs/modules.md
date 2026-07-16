# System Modules Documentation

This document describes the structure and responsibilities of the backend modules (NestJS) and frontend modules (React).

---

## 1. Backend Modules (NestJS)

The NestJS backend codebase is located under `ecr-system/src/` and is divided into cohesive feature modules:

### A. Auth Module (`src/auth/`)
- **Responsibility:** User authentication, password hashing (`bcrypt`), and JSON Web Token (JWT) generation.
- **Key Files:**
  - `auth.service.ts`: Sign-in validation and payload token generation.
  - `auth.controller.ts`: Exposes login, registration, and refresh endpoints.
  - `jwt.strategy.ts` & `jwt-auth.guard.ts`: Extends Passport JWT to extract and validate cookies containing the user session.

### B. Users Module (`src/users/`)
- **Responsibility:** User profile management and role configurations.
- **Key Files:**
  - `user.entity.ts`: Stores profile fields, encrypted passwords, roles, status, and salary reference.

### C. Defect Reports Module (`src/defect-reports/`)
- **Responsibility:** The core ECR domain handling CRUD operations, image storage, and status transitions.
- **Key Files:**
  - `defect-reports.service.ts`: Facade layer exposing all CRUD operations and delegating transactions.
  - `defect-reports-workflow.service.ts`: Handles the workflow state machine transitions (`inspect`, `smReview`, `gmApprove`, `transitionStatus`, `issueComponents`).
  - `defect-reports-image.service.ts`: Integrates Multer files with the `ImageUploadService` for Cloudinary synchronization.
  - `defect-report.entity.ts`: Relational schema mapping reports, processes, batches, and relation associations.
  - `utils/cost-calculator.ts`: Shared logic for Stage-Wise and total ECR cost calculations.

### D. Salary Deduction Module (`src/salary-deduction/`)
- **Responsibility:** Automatic operator fault financial recovery tracking.
- **Key Files:**
  - `salary-deduction.service.ts`: Listens for the `report.approved.operator_fault` event. Resolves Operator IDs, matches cost rates, and inserts deduction logs.
  - `salary-deduction.entity.ts`: Stores report associations, matched operators, loss amount ratios, and deductions.

### E. Notifications Module (`src/notifications/`)
- **Responsibility:** Real-time application alerts and email notifications.
- **Key Files:**
  - `notification.listener.ts`: Subscribes to the `report.status.changed` event and coordinates notification delivery.
  - `notifications.service.ts`: Creates database logs and emits notifications to connected Socket.io namespaces.

### F. Email Module (`src/email/`)
- **Responsibility:** Transmitting, queuing, and retrying email messages.
- **Key Files:**
  - `services/email.service.ts`: Core email broker. Queues failed dispatches in the database.
  - `services/gmail-smtp.service.ts`: Uses Gmail credentials or delegates to a Google Apps Script HTTPS proxy to prevent SMTP blockages.
  - `entities/email-log.entity.ts`: Stores email log records, recipient indexes, sending attempts, and failure reasons.

### G. Analytics Module (`src/analytics/`)
- **Responsibility:** Compiling KPI values, failure trends, and machine failure frequencies.
- **Key Files:**
  - `analytics.service.ts`: Aggregates metrics (defect types, SLA resolution durations, vendor ratings, operator fault counts).

### H. Monitoring Module (`src/monitoring/`)
- **Responsibility:** Core diagnostic telemetry and alerting.
- **Key Files:**
  - `monitoring.service.ts`: Audits database connection pools, memory usage, CPU, and alerts admins if parameters exceed thresholds.

---

## 2. Frontend Modules (React)

The frontend SPA is located inside the `frontend/` folder, structured around a standard Vite project layout:

### A. Contexts (`frontend/src/contexts/`)
- **`AuthContext.jsx`:** Tracks logged-in user profile, permissions, and exposes `login`/`logout` API handlers.

### B. Shared Components (`frontend/src/components/`)
- **`ActionModal.jsx`:** A standard backdrop modal wrapper used across review, rejection, and component issuance flows.
- **`Navbar.jsx` & `Sidebar.jsx`:** Left/top navigation templates displaying role-appropriate links.
- **`ReportCard.jsx`:** Renders summaries of defect reports.

### C. Pages (`frontend/src/pages/`)
- **`LoginPage.jsx`:** Unified landing portal supporting Staff and Admin login portals.
- **`ReportDetailPage.jsx`:** Comprehensive ECR detail view containing the inspector workflow forms, cost verification panel, and GM action controls.
- **`NewReportPage.jsx`:** Form to raise new ECR drafts, supporting dynamic template selections and file uploads.
- **`EnterpriseAnalytics.jsx`:** Recharts-driven dashboard visualizing performance metrics.
- **`UsersPage.jsx`:** Accessible to Admin users to configure staff roles.

### D. Utilities (`frontend/src/utils/`)
- **`constants.js`:** Defines `PROCESS_TEMPLATES`, helper methods like `getActiveStages`, and `sumStageCosts`.
- **`api.js`:** Configured Axios instance with automated credentials handling (HttpOnly cookie forwarding).
