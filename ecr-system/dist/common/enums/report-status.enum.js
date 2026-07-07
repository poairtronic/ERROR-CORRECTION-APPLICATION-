"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationStatus = exports.NotificationChannel = exports.RecoveryStatus = exports.ResponsibleParty = exports.Decision = exports.RaisedByRole = exports.ReportStatus = void 0;
var ReportStatus;
(function (ReportStatus) {
    ReportStatus["DRAFT"] = "DRAFT";
    ReportStatus["PENDING_INSPECTION"] = "PENDING_INSPECTION";
    ReportStatus["PENDING_SM_REVIEW"] = "PENDING_SM_REVIEW";
    ReportStatus["PENDING_GM_APPROVAL"] = "PENDING_GM_APPROVAL";
    ReportStatus["APPROVED"] = "APPROVED";
    ReportStatus["REJECTED"] = "REJECTED";
    ReportStatus["COMPONENTS_ISSUED"] = "COMPONENTS_ISSUED";
    ReportStatus["REWORK_IN_PROGRESS"] = "REWORK_IN_PROGRESS";
    ReportStatus["NEW_PRODUCTION"] = "NEW_PRODUCTION";
    ReportStatus["CLOSED"] = "CLOSED";
})(ReportStatus || (exports.ReportStatus = ReportStatus = {}));
var RaisedByRole;
(function (RaisedByRole) {
    RaisedByRole["OPERATOR"] = "OPERATOR";
    RaisedByRole["INSPECTOR"] = "INSPECTOR";
    RaisedByRole["SENIOR_MANAGER"] = "SENIOR_MANAGER";
})(RaisedByRole || (exports.RaisedByRole = RaisedByRole = {}));
var Decision;
(function (Decision) {
    Decision["REWORK"] = "REWORK";
    Decision["SCRAP"] = "SCRAP";
    Decision["ALTERNATIVE"] = "ALTERNATIVE";
})(Decision || (exports.Decision = Decision = {}));
var ResponsibleParty;
(function (ResponsibleParty) {
    ResponsibleParty["OPERATOR"] = "OPERATOR";
    ResponsibleParty["VENDOR"] = "VENDOR";
    ResponsibleParty["PROCESS"] = "PROCESS";
    ResponsibleParty["MACHINE"] = "MACHINE";
})(ResponsibleParty || (exports.ResponsibleParty = ResponsibleParty = {}));
var RecoveryStatus;
(function (RecoveryStatus) {
    RecoveryStatus["PENDING"] = "PENDING";
    RecoveryStatus["RAISED"] = "RAISED";
    RecoveryStatus["RECOVERED"] = "RECOVERED";
    RecoveryStatus["PARTIALLY_RECOVERED"] = "PARTIALLY_RECOVERED";
    RecoveryStatus["WAIVED"] = "WAIVED";
    RecoveryStatus["CANCELLED"] = "CANCELLED";
})(RecoveryStatus || (exports.RecoveryStatus = RecoveryStatus = {}));
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["EMAIL"] = "EMAIL";
    NotificationChannel["APP"] = "APP";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["QUEUED"] = "QUEUED";
    NotificationStatus["SENT"] = "SENT";
    NotificationStatus["FAILED"] = "FAILED";
    NotificationStatus["DELIVERED"] = "DELIVERED";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
//# sourceMappingURL=report-status.enum.js.map