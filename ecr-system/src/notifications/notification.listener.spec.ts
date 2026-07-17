import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotificationListener } from './notification.listener';
import { User } from '../users/user.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { NotificationsService } from './notifications.service';
import { StatusNotificationHandler } from './handlers/status-notification.handler';
import { EventNotificationHandler } from './handlers/event-notification.handler';
import { ReportStatus } from '../common/enums/report-status.enum';

describe('NotificationListener', () => {
  let listener: NotificationListener;
  const mockUsersRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockReportsRepo = { findOne: jest.fn() };
  const mockConfig = { get: jest.fn().mockReturnValue('http://localhost') };
  const mockNotificationsService = { create: jest.fn() };
  const mockStatusHandler = {
    handlePendingInspection: jest.fn(),
    handlePendingAccountsReview: jest.fn(),
    handlePendingSmReview: jest.fn(),
    handlePendingGmApproval: jest.fn(),
    handleApproved: jest.fn(),
    handleComponentsIssued: jest.fn(),
    handleRejected: jest.fn(),
    handleReworkInProgress: jest.fn(),
    handleNewProduction: jest.fn(),
    handleClosed: jest.fn(),
    sendPrivateReportToSm: jest.fn(),
  };
  const mockEventHandler = {
    handleComponentIssued: jest.fn(),
    handleSalaryDeductionCreated: jest.fn(),
    handleVendorFaultCreated: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationListener,
        { provide: getRepositoryToken(User), useValue: mockUsersRepo },
        { provide: getRepositoryToken(DefectReport), useValue: mockReportsRepo },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: ConfigService, useValue: mockConfig },
        { provide: StatusNotificationHandler, useValue: mockStatusHandler },
        { provide: EventNotificationHandler, useValue: mockEventHandler },
      ],
    }).compile();

    listener = module.get<NotificationListener>(NotificationListener);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('handleStatusChanged should call handlePendingInspection', async () => {
    mockReportsRepo.findOne.mockResolvedValue({ id: 'r1' });
    await listener.handleStatusChanged({ reportId: 'r1', status: ReportStatus.PENDING_INSPECTION } as any);
    expect(mockStatusHandler.handlePendingInspection).toHaveBeenCalled();
  });

  it('handleStatusChanged should call handlePendingAccountsReview', async () => {
    mockReportsRepo.findOne.mockResolvedValue({ id: 'r1' });
    await listener.handleStatusChanged({ reportId: 'r1', status: ReportStatus.PENDING_ACCOUNTS_REVIEW } as any);
    expect(mockStatusHandler.handlePendingAccountsReview).toHaveBeenCalled();
  });

  it('handleStatusChanged should call handlePendingSmReview', async () => {
    mockReportsRepo.findOne.mockResolvedValue({ id: 'r1' });
    await listener.handleStatusChanged({ reportId: 'r1', status: ReportStatus.PENDING_SM_REVIEW } as any);
    expect(mockStatusHandler.handlePendingSmReview).toHaveBeenCalled();
  });

  it('handleStatusChanged should call handlePendingGmApproval', async () => {
    mockReportsRepo.findOne.mockResolvedValue({ id: 'r1' });
    await listener.handleStatusChanged({ reportId: 'r1', status: ReportStatus.PENDING_GM_APPROVAL } as any);
    expect(mockStatusHandler.handlePendingGmApproval).toHaveBeenCalled();
  });

  it('handleStatusChanged should call handleApproved', async () => {
    mockReportsRepo.findOne.mockResolvedValue({ id: 'r1' });
    await listener.handleStatusChanged({ reportId: 'r1', status: ReportStatus.APPROVED } as any);
    expect(mockStatusHandler.handleApproved).toHaveBeenCalled();
  });

  it('handleStatusChanged should call handleComponentsIssued', async () => {
    mockReportsRepo.findOne.mockResolvedValue({ id: 'r1' });
    await listener.handleStatusChanged({ reportId: 'r1', status: ReportStatus.COMPONENTS_ISSUED } as any);
    expect(mockStatusHandler.handleComponentsIssued).toHaveBeenCalled();
  });

  it('handleStatusChanged should call handleRejected', async () => {
    mockReportsRepo.findOne.mockResolvedValue({ id: 'r1' });
    await listener.handleStatusChanged({ reportId: 'r1', status: ReportStatus.REJECTED } as any);
    expect(mockStatusHandler.handleRejected).toHaveBeenCalled();
  });

  it('handleStatusChanged should call handleReworkInProgress', async () => {
    mockReportsRepo.findOne.mockResolvedValue({ id: 'r1' });
    await listener.handleStatusChanged({ reportId: 'r1', status: ReportStatus.REWORK_IN_PROGRESS } as any);
    expect(mockStatusHandler.handleReworkInProgress).toHaveBeenCalled();
  });

  it('handleStatusChanged should call handleNewProduction', async () => {
    mockReportsRepo.findOne.mockResolvedValue({ id: 'r1' });
    await listener.handleStatusChanged({ reportId: 'r1', status: ReportStatus.NEW_PRODUCTION } as any);
    expect(mockStatusHandler.handleNewProduction).toHaveBeenCalled();
  });

  it('handleStatusChanged should call handleClosed', async () => {
    mockReportsRepo.findOne.mockResolvedValue({ id: 'r1' });
    await listener.handleStatusChanged({ reportId: 'r1', status: ReportStatus.CLOSED } as any);
    expect(mockStatusHandler.handleClosed).toHaveBeenCalled();
  });

  it('buildEmailSummary should handle actor correctly', async () => {
    mockUsersRepo.findOne.mockRejectedValue(new Error());
    const report = { id: 'r1', reportNumber: '123' };
    const event = { actor: { id: 'u1', role: 'ADMIN' } };
    const summary = await (listener as any).buildEmailSummary(report, event);
    expect(summary['Action By']).toBe('ADMIN');
  });

  it('notifyAdmins should send notifications to admins', async () => {
    mockUsersRepo.find.mockResolvedValue([{ id: 'a1', email: 'a@test.com' }]);
    await (listener as any).notifyAdmins({ id: 'r1' }, 'type', 'subj', 'msg', {});
    expect(mockNotificationsService.create).toHaveBeenCalled();
  });

  it('handleStatusChanged should catch fetch error', async () => {
    mockReportsRepo.findOne.mockRejectedValue(new Error('db error'));
    await listener.handleStatusChanged({ reportId: 'r1', status: ReportStatus.PENDING_INSPECTION } as any);
    // should not throw and not call handler
    expect(mockStatusHandler.handlePendingInspection).not.toHaveBeenCalled();
  });

  it('handleStatusChanged should do nothing if report not found', async () => {
    mockReportsRepo.findOne.mockResolvedValue(null);
    await listener.handleStatusChanged({ reportId: 'r1', status: ReportStatus.PENDING_INSPECTION } as any);
    expect(mockStatusHandler.handlePendingInspection).not.toHaveBeenCalled();
  });

  it('handleComponentIssued should delegate to handler', async () => {
    await listener.handleComponentIssued({ reportId: 'r1', issueId: 'i1', issuedToId: 'u1' });
    expect(mockEventHandler.handleComponentIssued).toHaveBeenCalledWith({ reportId: 'r1', issueId: 'i1', issuedToId: 'u1' }, 'http://localhost:5173');
  });

  it('handleSalaryDeductionCreated should delegate to handler', async () => {
    const payload = { deductionId: 'd1', operatorId: 'o1', amount: 100, reportId: 'r1' };
    await listener.handleSalaryDeductionCreated(payload);
    expect(mockEventHandler.handleSalaryDeductionCreated).toHaveBeenCalledWith(payload, 'http://localhost:5173');
  });

  it('handleVendorFaultCreated should delegate to handler', async () => {
    const payload = { faultId: 'f1', vendorId: 'v1', reportId: 'r1' };
    await listener.handleVendorFaultCreated(payload);
    expect(mockEventHandler.handleVendorFaultCreated).toHaveBeenCalledWith(payload, 'http://localhost:5173');
  });
});
