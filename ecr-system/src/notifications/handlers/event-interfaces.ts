import { ReportStatus } from '../../common/enums/report-status.enum';
import { Role } from '../../common/enums/role.enum';

export interface StatusChangedEvent {
  reportId: string;
  reportNumber: string;
  status: ReportStatus;
  fromStatus?: ReportStatus;
  actor?: { id: string; role: Role };
  actionTaken?: string;
  comments?: string;
  messageToSm?: string;
}
