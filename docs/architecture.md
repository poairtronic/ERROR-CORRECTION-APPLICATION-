# System Architecture Document

This document provides a comprehensive overview of the **Error Correction Report (ECR) Digitization System's** high-level architecture, module dependency structure, request lifecycle, and data flow patterns.

---

## 1. High-Level Design Overview

The application is structured as a decoupled client-server system designed to run on containerized environments (such as Render) with external persistent relational storage (Neon PostgreSQL).

```mermaid
graph TD
    Client["React SPA Frontend (Vite)"]
    API["NestJS Backend API (Node.js)"]
    DB[("Neon PostgreSQL DB")]
    Cloudinary["Cloudinary (Image Storage)"]
    GAS["Google Apps Script (SMTP Proxy)"]

    Client -->|HTTPS REST Requests / Socket.io| API
    API -->|SQL Queries / TypeORM| DB
    API -->|HTTPS SDK Uploads| Cloudinary
    API -->|HTTPS Request Proxy| GAS
```

---

## 2. Decoupled Service Tier

### Backend (NestJS Server)
- **Framework Model:** Modular dependency injection runtime leveraging controller-service-repository patterns.
- **Data Tier:** PostgreSQL integration using TypeORM (active connection pooler, pessimistic write locking).
- **Event Bus:** `@nestjs/event-emitter` decouples state machine transitions from resource-intensive actions (app notification creation and SMTP email dispatching).

### Frontend (React SPA)
- **Runtime:** React 18 powered by Vite.
- **Client Cache Management:** React Query (`@tanstack/react-query`) handles query caching, mutation states, and automatic cache invalidation (Query Keys matching REST endpoints).
- **Styling & UX:** Vanilla CSS custom variables, skeletons, toast alerts (`react-hot-toast`), and responsive CSS grids.

---

## 3. Module Dependency Diagram

The following diagram illustrates how components and services depend on each other inside the NestJS server.

```mermaid
graph TD
    AppModule["AppModule"]
    AuthModule["AuthModule"]
    DefectReportsModule["DefectReportsModule"]
    SalaryDeductionModule["SalaryDeductionModule"]
    NotificationsModule["NotificationsModule"]
    EmailModule["EmailModule"]
    MonitoringModule["MonitoringModule"]

    AppModule --> AuthModule
    AppModule --> DefectReportsModule
    AppModule --> SalaryDeductionModule
    AppModule --> NotificationsModule
    AppModule --> EmailModule
    AppModule --> MonitoringModule

    DefectReportsModule -.->|EventEmitter| NotificationsModule
    DefectReportsModule -.->|EventEmitter| SalaryDeductionModule
    NotificationsModule --> EmailModule
```

---

## 4. End-to-End Request Data Flow

This lifecycle trace demonstrates what happens when an operator or inspector submits an action:

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant Filter as Throttler / CORS Guards
    participant Controller as DefectReportsController
    participant Facade as DefectReportsService
    participant Workflow as DefectReportsWorkflowService
    participant DB as Postgres Database
    participant Bus as NestJS EventEmitter2
    participant Listener as NotificationListener

    User->>Filter: PATCH /api/defect-reports/:id/inspect
    Filter->>Controller: Parse & Validate InspectReportDto
    Controller->>Facade: inspect(id, dto, user)
    Facade->>Workflow: inspect(id, dto, user)
    Note over Workflow,DB: Open Database Transaction (pessimistic_write lock)
    Workflow->>DB: Fetch & lock report, Save InspectionDetail
    Workflow->>DB: Recalculate cost & update report status
    Note over Workflow,DB: Commit Database Transaction
    Workflow->>Bus: emit('report.status.changed', event)
    Workflow-->>User: Return updated DefectReport
    Bus-.->Listener: handleStatusChanged(event)
    Listener->>DB: Query Preferences & target users
    Listener->>User: Push WebSocket app notification
```

---

## 5. Observability & Logging Architecture

The application implements observability at three critical points:
1. **Metrics Interceptor (`MetricsInterceptor`):** Tracks latency, request/response metrics, and failed exception durations. Logs outputs using the NestJS Logger.
2. **Monitoring Dashboard (`MonitoringService`):** Exposes system metrics (active connections, RAM/CPU load, email queue latency, and transaction threshold alerts) through a secured endpoint `/api/admin/monitoring/dashboard`.
3. **Structured Event Logs:** Explicit diagnostic logs written with tag prefixes (`[EMAIL_DIAGNOSTICS]`, `[SALARY_DEDUCTION_WARN]`) facilitate quick analysis of production application logs.
