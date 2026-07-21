# ♊ Gemini CLI Project Instructions: ECR Digitization System

Welcome to the **Enterprise Error Correction Report (ECR) Digitization System** workspace. This file establishes repository-wide architectural patterns, workflows, coding conventions, and developer commands to align and guide AI assistant interactions.

---

## 🗺️ Workspace & Repository Architecture

This project is organized as a monolithic repository using **npm Workspaces**:
*   **Root Workspace**: Coordinates dependencies and overall builds.
*   **Backend (`/ecr-system`)**: A NestJS enterprise-tier REST API using TypeScript, TypeORM, and PostgreSQL (Neon/local).
*   **Frontend (`/frontend`)**: A React SPA powered by Vite, utilizing Tailwind-like custom vanilla CSS properties, React Query, and Axios.

### 📚 Scoped Subdirectory Instructions
To maintain lean instructions, specific guidelines for each workspace have been separated:
*   👉 **[Backend Guidelines](./ecr-system/GEMINI.md)**: Details on database concurrency (pessimistic locking), NestJS module boundaries, event emitters, structured logging, and test suites.
*   👉 **[Frontend Guidelines](./frontend/GEMINI.md)**: React state management, React Query cache strategies, vanilla CSS custom properties, and UI components.

---

## 🛠️ Essential Developer Commands

Always run commands in their corresponding workspaces or using workspace flags. Avoid running generic commands.

| Action | Target Location | Command |
| :--- | :--- | :--- |
| Install All Dependencies | Root Workspace | `npm install` |
| Build All Workspaces | Root Workspace | `npm run build` |
| Launch Backend API (Dev) | `/ecr-system` | `npm run start:dev` |
| Run Backend Tests | `/ecr-system` | `npx jest` (or `npm test`) |
| Launch Frontend (Dev) | `/frontend` | `npm run dev` |
| Lint Frontend Code | `/frontend` | `npm run lint` |

---

## ⚡ Core Domain Rules & Business Logic

Ensure any changes respect these primary domain rules:

### 1. Unified ECR State Machine Transitions
A report moves sequentially through these main statuses:
`DRAFT` ➡️ `PENDING_INSPECTION` ➡️ `PENDING_ACCOUNTS_REVIEW` ➡️ `PENDING_SM_REVIEW` ➡️ `PENDING_GM_APPROVAL` ➡️ `APPROVED` ➡️ `COMPONENTS_ISSUED` ➡️ `REWORK_IN_PROGRESS`/`NEW_PRODUCTION` ➡️ `CLOSED`.
*   **Skip-Ahead Optimization:**
    *   *Inspector raises:* Direct to `PENDING_ACCOUNTS_REVIEW` (inline inspection required).
    *   *Senior Manager raises:* Direct to `PENDING_GM_APPROVAL` (inline inspection and SM review required).

### 2. Concurrency Locking & DB Transactions
Database integrity is paramount on high-concurrency actions.
*   **Locking:** Always use Pessimistic Write locks (`pessimistic_write`) when mutating reports to avoid double-accounting.
*   **Postgres outer-join compatibility:** Always specify `relationLoadStrategy: 'query'` on locked transactions to bypass PostgreSQL limitations on left outer joins inside `FOR UPDATE` queries.

### 3. Financial Cost Calculation
Total ECR costs must dynamically incorporate Stage Costs:
$$\text{Total Cost} = \text{Material Cost} + \text{Labour Cost} + \text{Other Cost} + \sum (\text{Active Stage Costs})$$
*   Active stages are resolved by slicing the selected process template up to the `failedStage` index (inclusive).
*   Costs are matched against `rejectionStageCosts` dynamically in the backend workflow service.

### 4. Decoupling & Event Bus Pattern
Do not trigger heavy actions (e.g., SMTP dispatching or WebSocket notification creation) inside request-response database transactions.
*   Instead, emit synchronous or asynchronous events using NestJS `@nestjs/event-emitter`.
*   Listen for events in background subscribers (e.g., `NotificationListener`) to finalize deliveries.

---

## 📝 Coding Standards & Aesthetic Requirements

1.  **Do Not Suppress Types or Warnings**: Avoid casts (e.g., `as any`) or eslint suppression comments. Write precise TypeScript definitions.
2.  **No Unverified Dependencies**: Do not install new third-party npm packages without checking the workspace-level `package.json` for existing usage.
3.  **Structured Observability**: Tag diagnostic logging using specific tag prefixes (`[EMAIL_DIAGNOSTICS]`, `[SALARY_DEDUCTION_WARN]`) to ensure log routing works correctly.
4.  **No Monospace Interruption**: Keep responses concise, direct, and completely monospaced (suitable for terminal displays).
