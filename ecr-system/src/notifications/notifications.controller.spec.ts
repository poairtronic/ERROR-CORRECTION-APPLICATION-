import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotFoundException } from '@nestjs/common';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  
  const mockService = {
    findForUser: jest.fn(),
    canAccessReportNotifications: jest.fn(),
    findByReport: jest.fn(),
    markRead: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('findMine should return user notifications', async () => {
    mockService.findForUser.mockResolvedValue([]);
    await controller.findMine({ id: 'u1' }, 'true');
    expect(mockService.findForUser).toHaveBeenCalledWith('u1', true);
  });

  it('findByReport should return notifications if accessible', async () => {
    mockService.canAccessReportNotifications.mockResolvedValue(true);
    mockService.findByReport.mockResolvedValue([]);
    
    await controller.findByReport('r1', { id: 'u1', role: 'ADMIN' });
    
    expect(mockService.canAccessReportNotifications).toHaveBeenCalledWith('r1', 'u1', 'ADMIN');
    expect(mockService.findByReport).toHaveBeenCalledWith('r1');
  });

  it('findByReport should throw NotFoundException if inaccessible', async () => {
    mockService.canAccessReportNotifications.mockResolvedValue(false);
    await expect(controller.findByReport('r1', { id: 'u1', role: 'USER' })).rejects.toThrow(NotFoundException);
  });

  it('markRead should mark read', async () => {
    await controller.markRead('n1');
    expect(mockService.markRead).toHaveBeenCalledWith('n1');
  });
});
