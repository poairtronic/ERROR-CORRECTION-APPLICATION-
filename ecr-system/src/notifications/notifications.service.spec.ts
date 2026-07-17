import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { Notification } from './notification.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { EmailService } from '../email/services/email.service';
import { NotificationsGateway } from './notifications.gateway';
import { SocketRegistryService } from './socket-registry.service';
import { NotificationChannel, NotificationStatus } from '../common/enums/report-status.enum';
import { NotificationEvent } from '../email/enums/notification-event.enum';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockNotifRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockReportRepo = {
    findOne: jest.fn(),
  };

  const mockConfig = { get: jest.fn() };
  const mockRegistry = { isUserConnected: jest.fn() };
  const mockEmailService = { queueEmail: jest.fn() };
  const mockGateway = { pushToUser: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: mockNotifRepo },
        { provide: getRepositoryToken(DefectReport), useValue: mockReportRepo },
        { provide: ConfigService, useValue: mockConfig },
        { provide: SocketRegistryService, useValue: mockRegistry },
        { provide: EmailService, useValue: mockEmailService },
        { provide: NotificationsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create should save notification and push WebSocket', async () => {
    mockRegistry.isUserConnected.mockReturnValue(true);
    mockNotifRepo.create.mockImplementation((dto) => dto);
    mockNotifRepo.save.mockResolvedValue({ id: '1', ...mockNotifRepo.create() });
    
    await service.create({
      userId: 'u1',
      userEmail: 'u@e.com',
      channel: NotificationChannel.APP,
      type: 'test',
      message: 'msg',
      event: NotificationEvent.REPORT_UPDATED,
      templateData: {},
      subject: 'sub'
    });

    expect(mockNotifRepo.save).toHaveBeenCalled();
    expect(mockGateway.pushToUser).toHaveBeenCalled();
    expect(mockEmailService.queueEmail).not.toHaveBeenCalled();
  });

  it('create should queue email if channel includes EMAIL', async () => {
    mockRegistry.isUserConnected.mockReturnValue(false);
    mockNotifRepo.create.mockImplementation((dto) => dto);
    mockNotifRepo.save.mockResolvedValue({ id: '1' });
    
    await service.create({
      userId: 'u1',
      userEmail: 'u@e.com',
      channel: NotificationChannel.APP_AND_EMAIL,
      type: 'test',
      message: 'msg',
      event: NotificationEvent.REPORT_UPDATED,
      templateData: {},
      subject: 'sub'
    });

    expect(mockEmailService.queueEmail).toHaveBeenCalled();
  });

  it('canAccessReportNotifications should return true for admin', async () => {
    expect(await service.canAccessReportNotifications('r1', 'u1', 'ADMIN')).toBe(true);
  });

  it('canAccessReportNotifications should return false if report not found', async () => {
    mockReportRepo.findOne.mockResolvedValue(null);
    expect(await service.canAccessReportNotifications('r1', 'u1', 'USER')).toBe(false);
  });

  it('canAccessReportNotifications should return true if raisedById', async () => {
    mockReportRepo.findOne.mockResolvedValue({ raisedById: 'u1' });
    expect(await service.canAccessReportNotifications('r1', 'u1', 'USER')).toBe(true);
  });

  it('canAccessReportNotifications should return true if responsibleId', async () => {
    mockReportRepo.findOne.mockResolvedValue({ raisedById: 'u2', inspectionDetail: { responsibleId: 'u1' } });
    expect(await service.canAccessReportNotifications('r1', 'u1', 'USER')).toBe(true);
  });

  it('markRead should update read status', async () => {
    await service.markRead('1');
    expect(mockNotifRepo.update).toHaveBeenCalledWith('1', { read: true });
  });

  it('markDelivered should update status', async () => {
    await service.markDelivered('1');
    expect(mockNotifRepo.update).toHaveBeenCalledWith('1', { status: NotificationStatus.DELIVERED });
  });

  it('findForUser should return notifications', async () => {
    mockNotifRepo.find.mockResolvedValue([]);
    await service.findForUser('u1', true);
    expect(mockNotifRepo.find).toHaveBeenCalledWith({ where: { userId: 'u1', read: false }, order: { createdAt: 'DESC' }, relations: ['report'] });
  });

  it('findByReport should return notifications', async () => {
    mockNotifRepo.find.mockResolvedValue([]);
    await service.findByReport('r1');
    expect(mockNotifRepo.find).toHaveBeenCalledWith({ where: { reportId: 'r1' }, order: { createdAt: 'ASC' } });
  });
});
