# Notification Event Flow Matrix

This matrix maps every business workflow action to its corresponding real-time and email notification flow within the ECR System. 

For all events listed below, the `EmailService.queueEmail()` method is invoked. This method guarantees that every single notification in this matrix is **Saved (Database)**, **Pushed (WebSocket via ACKs)**, **Queued**, and eventually **Sent (Email via SMTP)**.

| Workflow Action | Emitting Service | Event Payload | Receiving Listener | Notified Users | Email Template / Event Enum | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Inspector Submits Report**<br/>(or updates status to Pending SM) | `DefectReportsService` | `report.status.changed`<br/>*(PENDING_SM_REVIEW)* | `handlePendingSmReview` | Senior Managers | `REPORT_UPDATED`<br/>*(Title: New Defect Report Pending Your Review)* | Saved, Pushed, Queued, Sent |
| **Senior Manager Approves**<br/>(Forwards to GM) | `DefectReportsService` | `report.status.changed`<br/>*(PENDING_GM_APPROVAL)* | `handlePendingGmApproval` | General Managers | `REPORT_UPDATED`<br/>*(Title: Report Pending Final Approval)* | Saved, Pushed, Queued, Sent |
| **General Manager Approves**<br/>(Final Approval) | `DefectReportsService` | `report.status.changed`<br/>*(APPROVED)* | `handleApproved` | Sales Team,<br/>Store Managers | `REPORT_APPROVED`<br/>*(Title: Defect Report Approved / Component Issue Request)* | Saved, Pushed, Queued, Sent |
| **Report Rejected**<br/>(By SM or GM) | `DefectReportsService` | `report.status.changed`<br/>*(REJECTED)* | `handleRejected` | Original Inspector,<br/>Senior Manager (if GM rejected) | `REPORT_REJECTED`<br/>*(Title: Report Rejected)* | Saved, Pushed, Queued, Sent |
| **Store Manager Issues Components** | `ComponentIssueService` | `component.issued` | `handleComponentIssued` | Issuee (Inspector) | `COMPONENT_ISSUED`<br/>*(Title: Components Issued for Report)* | Saved, Pushed, Queued, Sent |
| **Operator Fault Identified**<br/>(Triggered by GM Approval) | `SalaryDeductionService` | `salary.deduction.created` | `handleSalaryDeductionCreated` | Administrators | `SALARY_DEDUCTION`<br/>*(Title: Salary Deduction Record)* | Saved, Pushed, Queued, Sent |
| **Vendor Fault Identified**<br/>(Triggered by GM Approval) | `VendorFaultService` | `vendor.fault.created` | `handleVendorFaultCreated` | Administrators | `VENDOR_FAULT`<br/>*(Title: Vendor Fault Recorded)* | Saved, Pushed, Queued, Sent |

---

### Understanding the Disposition (Status) Pipeline
1. **Saved**: `EmailService` immediately inserts a record into the `notifications` table with status `QUEUED`.
2. **Pushed via WebSocket**: The record is passed to `NotificationsGateway.pushToUser()`. If the user is online, it is emitted. Upon client acknowledgment (ACK), the status upgrades to `DELIVERED`.
3. **Queued & Sent**: `EmailQueueService` processes the payload asynchronously via Nodemailer. If successful, the status upgrades to `SENT`. If SMTP fails, the status falls back to `FAILED` and is picked up by `NotificationRetryCron` 5 minutes later.
