# Enterprise Error Correction Report (ECR) Digitization System

An enterprise-grade platform for digitizing, tracking, and resolving factory floor defect reports. This system elevates basic operational workflows into an executive decision platform, offering robust reporting, analytical intelligence, SLA tracking, and stringent quality governance.

## Architecture

This application employs a modern decoupled architecture:

### Backend (NestJS / TypeORM / PostgreSQL)
- **Framework**: NestJS (v10) for robust, modular enterprise architecture.
- **ORM**: TypeORM, interacting with a Neon PostgreSQL database.
- **Security**: Hardened with Helmet HTTP headers, bcrypt password hashing, global exception filters (sanitizing stack traces), and HttpOnly cross-site cookies.
- **Observability**: Jest integration for robust unit testing over critical workflow state machines.

### Frontend (React / Vite)
- **Library**: React 18 with Vite for lightning-fast HMR and optimized builds.
- **State Management**: React Query (`@tanstack/react-query`) for API caching and synchronization.
- **Routing**: `react-router-dom` using standard REST-driven layouts.
- **Data Visualization**: Recharts for dynamic, memoized trend analysis and health scores.
- **UX/A11y**: Standardized skeleton loaders, empty states, and semantic HTML accessibility standards.

## Core Features

1. **Role-Based Workflows**: Multi-tiered authentication mapping to specialized UI dashboards for Operators, Line Managers, Section Managers, General Managers, Admin, and Finance.
2. **Executive Intelligence**: Advanced data aggregation and rule-based AI insights detecting vendor defect rates and inspection bottlenecks.
3. **Workflow Digitization**: Complete lifecycle tracking from Defect Raising -> Vendor Allocation -> Corrective Action -> SM Review -> GM Approval -> Finance Deduction.
4. **Audit Trails**: Immutability tracking of every lifecycle mutation for compliance and accountability.
5. **Master Data Management**: Centralized management of Vendors, Components, and Users.

## Installation & Setup

Ensure you have Node.js 22+ installed.

### 1. Install Dependencies (from project root)

```bash
npm install
```

### 2. Setup Backend

```bash
cd ecr-system
npm run start:dev
```

The backend API will run on `http://localhost:3000`.

### 3. Setup Frontend

```bash
cd frontend
npm run dev
```

The application will run on `http://localhost:5173`.

## Testing

The backend includes a comprehensive Jest test suite validating core analytical and authentication logic.

```bash
cd ecr-system
npx jest
```
