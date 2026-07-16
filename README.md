# Enterprise Error Correction Report (ECR) Digitization System

An enterprise-grade platform for digitizing, tracking, and resolving factory floor defect reports. This system elevates basic operational workflows into an executive decision platform, offering robust reporting, analytical intelligence, SLA tracking, and stringent quality governance.

---

## 📚 Technical Documentation Suite

For deep-dive architectural specifications, developer setup instructions, and database details, refer to our comprehensive documentation folder:

1. **[System Architecture Guide](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/docs/architecture.md)** — Architectural design, dependency graphs, request pipelines, and logging specifications.
2. **[System Modules Guide](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/docs/modules.md)** — Backend NestJS feature modules breakdown and frontend React page/component architecture.
3. **[Database & Schema Guide](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/docs/database.md)** — Entity dictionaries, indices, and pessimistic write lock configurations.
4. **[Workflow & Process Integrity Guide](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/docs/workflow.md)** — Lifecycle state diagrams, permission access tables, and financial aggregation cost formulas.
5. **[Deployment & Developer Operations Guide](file:///c:/Users/Admin/Downloads/ERROR%20CORRECTION%20APPLICATION/docs/deployment.md)** — Local onboarding setups, scaling guidelines, and Render deployment specifications.

---

## ⚡ Quick Start

### 1. Install Dependencies
Execute from the workspace root:
```bash
npm install
```

### 2. Launch Services
Run backend dev server:
```bash
cd ecr-system
npm run start:dev
```
Run React client:
```bash
cd frontend
npm run dev
```

---

## 🧪 Testing Suite
Run all integration and unit tests:
```bash
cd ecr-system
npx jest
```

