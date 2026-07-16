# Database & Schema Documentation

This document describes the schema structure, relation indexes, pessimistic concurrency locks, and optimization techniques employed in the Neon PostgreSQL database.

---

## 1. Database Entity Dictionary

The database maps feature modules to the following tables:

### A. `defect_report`
Stores the metadata and status of defect reports.
- **Fields:**
  - `id` (UUID, Primary Key)
  - `reportNumber` (VARCHAR, Unique, format: `AGIPL-YYYY-ERR-XXXXX`)
  - `status` (VARCHAR/Enum: `DRAFT`, `PENDING_INSPECTION`, `PENDING_ACCOUNTS_REVIEW`, etc.)
  - `raisedById` (UUID, FK referencing `user`)
  - `scOrPoNo` / `scNo` / `poNo` (VARCHAR, metadata)
  - `rejectionProcessTemplate` (VARCHAR)
  - `rejectionFailedStage` (VARCHAR)
  - `rejectionStageCosts` (JSONB, stores cost mapping)
  - `images` (TEXT[], array of secure Cloudinary URLs)
  - `createdAt` (TIMESTAMPTZ, Indexed)

### B. `inspection_detail`
Stores the inspection findings created by the Quality Inspector.
- **Fields:**
  - `id` (UUID, Primary Key)
  - `reportId` (UUID, FK referencing `defect_report`, Indexed)
  - `inspectorId` (UUID, FK referencing `user`)
  - `errorType` / `rootCause` (VARCHAR)
  - `responsibleParty` (VARCHAR/Enum: `OPERATOR`, `VENDOR`, `CUSTOMER`)
  - `responsibleId` (VARCHAR, stores operator FK or vendor name)
  - `costEstimate` / `labourCost` / `materialCost` / `otherCost` / `lossAmount` (DECIMAL/NUMERIC)
  - `costRemarks` (TEXT)

### C. `sm_review`
Records reviews submitted by Section/Senior Managers.
- **Fields:**
  - `id` (UUID, Primary Key)
  - `reportId` (UUID, FK referencing `defect_report`)
  - `smId` (UUID, FK referencing `user`)
  - `loopholeNote` / `decisionNote` (TEXT)
  - `biasedFlag` (BOOLEAN)
  - `forwardedToGm` (BOOLEAN)

### D. `gm_approval`
Records the final decision of the General Manager.
- **Fields:**
  - `id` (UUID, Primary Key)
  - `reportId` (UUID, FK referencing `defect_report`)
  - `gmId` (UUID, FK referencing `user`)
  - `approved` (BOOLEAN)
  - `remarks` (TEXT)
  - `budgetApproved` (NUMERIC)
  - `messageToSm` (TEXT)

### E. `salary_deduction`
Tracks financial deductions applied to operators deemed at fault.
- **Fields:**
  - `id` (UUID, Primary Key)
  - `reportId` (UUID, FK referencing `defect_report`, Indexed)
  - `operatorId` (UUID, FK referencing `operator`, Indexed)
  - `amount` (NUMERIC)
  - `status` (VARCHAR, Enum: `PENDING`, `COMPLETED`, `CANCELLED`, Indexed)

### F. `audit_log`
An immutable ledger tracking every change in a report's lifecycle.
- **Fields:**
  - `id` (UUID, Primary Key)
  - `reportId` (UUID, FK referencing `defect_report`)
  - `actorId` / `actorRole` (VARCHAR)
  - `actionType` (VARCHAR)
  - `fieldName` / `oldValue` / `newValue` (TEXT)

---

## 2. Database Indexes & Performance Optimization

To prevent performance degradation during analytical lookups, indices are declared on frequently joined fields:

1. **`user` Table:** Index on `@Index() role` and `salaryRefId` to speed up role-based queries.
2. **`notification` Table:** Index on `@Index() userId` and `reportId` to optimize sidebar badge lookups.
3. **`salary_deduction` Table:** Index on `reportId`, `operatorId`, and `status`.
4. **`audit_log` Table:** Index on `reportId` to fetch historical changelogs quickly.

---

## 3. Concurrency Control & Locking Strategy

To ensure data integrity on multiple client writes (e.g., Accounts and SM reviewing the same report simultaneously), the system enforces strict **Pessimistic Concurrency Locking**:

### SELECT ... FOR UPDATE
Before mutating any database state, the services request a write lock on the target report record:
```typescript
const report = await reportsRepo.findOne({
  where: { id: reportId },
  lock: { mode: 'pessimistic_write' },
});
```
This locks the report row in the database, blocking other transactions from reading/writing until the current transaction commits.

### Query Relation Loading Strategy
PostgreSQL has a strict constraint: `FOR UPDATE` queries cannot contain Left Outer Joins on nullable relation tables.

To solve this, the backend uses **`relationLoadStrategy: 'query'`** on locked queries:
```typescript
const report = await reportsRepo.findOne({
  where: { id: reportId },
  relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval', 'componentIssues'],
  relationLoadStrategy: 'query', // Bypasses outer-join locking limitation
  lock: { mode: 'pessimistic_write' },
});
```
This retrieves and locks the primary table record first, and then resolves the relation objects via separate backend queries. This ensures transaction safety and full PostgreSQL compatibility.
