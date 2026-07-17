import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventNotificationHandler } from './event-notification.handler';
import { User } from '../../users/user.entity';
import { DefectReport } from '../../defect-reports/defect-report.entity';
import { NotificationsService } from '../notifications.service';

describe('EventNotificationHandler', () => {
  let handler: EventNotificationHandler;
  const mockUsersRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockReportsRepo = { findOne: jest.fn() };
  const mockNotificationsService = { create: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventNotificationHandler,
        { provide: getRepositoryToken(User), useValue: mockUsersRepo },
        { provide: getRepositoryToken(DefectReport), useValue: mockReportsRepo },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    handler = module.get<EventNotificationHandler>(EventNotificationHandler);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('handleComponentIssued should create notification if user exists', async () => {
    mockUsersRepo.findOne.mockResolvedValue({ id: 'u1', email: 'u1@test.com' });
    mockReportsRepo.findOne.mockResolvedValue({ id: 'r1', reportNumber: '123' });
    
    await handler.handleComponentIssued({ reportId: 'r1', issueId: 'i1', issuedToId: 'u1' }, 'url');
    
    expect(mockUsersRepo.findOne).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(mockReportsRepo.findOne).toHaveBeenCalled();
    expect(mockNotificationsService.create).toHaveBeenCalled();
  });

  it('handleComponentIssued should do nothing if user not found', async () => {
    mockUsersRepo.findOne.mockResolvedValue(null);
    await handler.handleComponentIssued({ reportId: 'r1', issueId: 'i1', issuedToId: 'u1' }, 'url');
    expect(mockNotificationsService.create).not.toHaveBeenCalled();
  });

  it('handleSalaryDeductionCreated should notify admins', async () => {
    mockUsersRepo.find.mockResolvedValue([{ id: 'a1', email: 'a1@test.com' }]);
    
    await handler.handleSalaryDeductionCreated({ deductionId: 'd1', operatorId: 'o1', amount: 100, reportId: 'r1' }, 'url');
    
    expect(mockUsersRepo.find).toHaveBeenCalled();
    expect(mockNotificationsService.create).toHaveBeenCalled();
  });

  it('handleVendorFaultCreated should notify admins', async () => {
    mockUsersRepo.find.mockResolvedValue([{ id: 'a1', email: 'a1@test.com' }]);
    mockReportsRepo.findOne.mockResolvedValue({ id: 'r1', reportNumber: '123' });
    
    await handler.handleVendorFaultCreated({ faultId: 'f1', vendorId: 'v1', reportId: 'r1' }, 'url');
    
    expect(mockUsersRepo.find).toHaveBeenCalled();
    expect(mockReportsRepo.findOne).toHaveBeenCalled();
    expect(mockNotificationsService.create).toHaveBeenCalled();
  });
});
