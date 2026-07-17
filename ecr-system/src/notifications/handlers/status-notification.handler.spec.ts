import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StatusNotificationHandler } from './status-notification.handler';
import { User } from '../../users/user.entity';
import { DefectReport } from '../../defect-reports/defect-report.entity';
import { NotificationsService } from '../notifications.service';
import { Role } from '../../common/enums/role.enum';

describe('StatusNotificationHandler', () => {
  let handler: StatusNotificationHandler;
  const mockUsersRepo = { find: jest.fn() };
  const mockNotificationsService = { create: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatusNotificationHandler,
        { provide: getRepositoryToken(User), useValue: mockUsersRepo },
        { provide: getRepositoryToken(DefectReport), useValue: {} },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    handler = module.get<StatusNotificationHandler>(StatusNotificationHandler);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('handlePendingInspection should notify inspectors', async () => {
    mockUsersRepo.find.mockResolvedValue([{ id: 'u1', email: 'i@test.com' }]);
    const buildSummary = jest.fn().mockResolvedValue({});
    const report = { id: 'r1' } as any;

    await handler.handlePendingInspection(report, {} as any, 'url', buildSummary);

    expect(mockUsersRepo.find).toHaveBeenCalledWith({ where: { role: Role.INSPECTOR, isActive: true } });
    expect(mockNotificationsService.create).toHaveBeenCalled();
  });

  it('handlePendingAccountsReview should notify accounts', async () => {
    mockUsersRepo.find.mockResolvedValue([{ id: 'u2', email: 'a@test.com' }]);
    const buildSummary = jest.fn().mockResolvedValue({});
    const report = { id: 'r1' } as any;

    await handler.handlePendingAccountsReview(report, {} as any, 'url', buildSummary);

    expect(mockUsersRepo.find).toHaveBeenCalledWith({ where: { role: Role.ACCOUNTS, isActive: true } });
    expect(mockNotificationsService.create).toHaveBeenCalled();
  });

  it('handlePendingSmReview should notify SMs', async () => {
    mockUsersRepo.find.mockResolvedValue([{ id: 'u3' }]);
    const buildSummary = jest.fn().mockResolvedValue({});
    await handler.handlePendingSmReview({ id: 'r1' } as any, {} as any, 'url', buildSummary);
    expect(mockNotificationsService.create).toHaveBeenCalled();
  });

  it('handlePendingGmApproval should notify GMs', async () => {
    mockUsersRepo.find.mockResolvedValue([{ id: 'u4' }]);
    const buildSummary = jest.fn().mockResolvedValue({});
    await handler.handlePendingGmApproval({ id: 'r1' } as any, {} as any, 'url', buildSummary);
    expect(mockNotificationsService.create).toHaveBeenCalled();
  });

  it('handleApproved should notify accounts and store, plus admins and sm', async () => {
    mockUsersRepo.find.mockImplementation(async (q) => {
      if (q.where.role === Role.ACCOUNTS) return [{ id: 'a1' }];
      if (q.where.role === Role.STORE_MANAGER) return [{ id: 's1' }];
      return [];
    });
    const buildSummary = jest.fn().mockResolvedValue({});
    const notifyAdmins = jest.fn();
    const notifySm = jest.fn();

    await handler.handleApproved({ id: 'r1' } as any, {} as any, 'url', buildSummary, notifyAdmins, notifySm);

    expect(mockNotificationsService.create).toHaveBeenCalledTimes(2);
    expect(notifyAdmins).toHaveBeenCalled();
    expect(notifySm).toHaveBeenCalled();
  });

  it('handleComponentsIssued should notify accounts and inspector + admins', async () => {
    mockUsersRepo.find.mockImplementation(async (q) => {
      if (q.where && q.where.role === Role.ACCOUNTS) return [{ id: 'a1' }];
      if (Array.isArray(q.where)) return [{ id: 'a1' }, { id: 'i1' }];
      return [];
    });
    const buildSummary = jest.fn().mockResolvedValue({});
    const notifyAdmins = jest.fn();
    const report = { id: 'r1', inspectionDetail: { inspectorId: 'i1' } } as any;

    await handler.handleComponentsIssued(report, {} as any, 'url', buildSummary, notifyAdmins);

    expect(mockNotificationsService.create).toHaveBeenCalledTimes(2);
    expect(notifyAdmins).toHaveBeenCalled();
  });

  it('handleRejected should notify accounts and inspector + admins + sm', async () => {
    mockUsersRepo.find.mockImplementation(async (q) => {
      if (q.where && q.where.role === Role.ACCOUNTS) return [{ id: 'a1' }];
      if (Array.isArray(q.where)) return [{ id: 'a1' }, { id: 'i1' }];
      return [];
    });
    const buildSummary = jest.fn().mockResolvedValue({});
    const notifyAdmins = jest.fn();
    const notifySm = jest.fn();
    const report = { id: 'r1', raisedById: 'i1' } as any;

    await handler.handleRejected(report, {} as any, 'url', buildSummary, notifyAdmins, notifySm);

    expect(mockNotificationsService.create).toHaveBeenCalledTimes(2);
    expect(notifyAdmins).toHaveBeenCalled();
    expect(notifySm).toHaveBeenCalled();
  });

  it('sendPrivateReportToSm should send private report if SM exists', async () => {
    mockUsersRepo.find.mockResolvedValue([{ id: 'sm1' }]);
    await handler.sendPrivateReportToSm({ id: 'r1' } as any, {} as any, 'url');
    expect(mockNotificationsService.create).toHaveBeenCalled();
  });

  it('handleClosed should notify admins', async () => {
    const notifyAdmins = jest.fn();
    await handler.handleClosed({ id: 'r1' } as any, {} as any, 'url', jest.fn(), notifyAdmins);
    expect(notifyAdmins).toHaveBeenCalled();
  });

  it('handleReworkInProgress should notify raiser and inspector', async () => {
    mockUsersRepo.find.mockResolvedValue([{ id: 'u1' }]);
    const report = { id: 'r1', raisedById: 'u1', inspectionDetail: { inspectorId: 'u2' } } as any;
    await handler.handleReworkInProgress(report, {} as any, 'url', jest.fn());
    expect(mockNotificationsService.create).toHaveBeenCalled();
  });

  it('handleNewProduction should notify raiser and inspector', async () => {
    mockUsersRepo.find.mockResolvedValue([{ id: 'u1' }]);
    const report = { id: 'r1', raisedById: 'u1', inspectionDetail: { inspectorId: 'u2' } } as any;
    await handler.handleNewProduction(report, {} as any, 'url', jest.fn());
    expect(mockNotificationsService.create).toHaveBeenCalled();
  });
});
