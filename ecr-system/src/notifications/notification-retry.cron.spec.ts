import { Test, TestingModule } from '@nestjs/testing';
import { NotificationRetryCron } from './notification-retry.cron';
import { NotificationsService } from './notifications.service';
import { MonitoringService } from '../monitoring/monitoring.service';

describe('NotificationRetryCron', () => {
  let cron: NotificationRetryCron;
  
  const mockNotificationsService = { retryFailed: jest.fn() };
  const mockMonitoringService = { recordQueueProcessingTime: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationRetryCron,
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: MonitoringService, useValue: mockMonitoringService },
      ],
    }).compile();

    cron = module.get<NotificationRetryCron>(NotificationRetryCron);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('handleRetry should call retryFailed and record time', async () => {
    mockNotificationsService.retryFailed.mockResolvedValue({ retried: 2 });
    
    await cron.handleRetry();
    
    expect(mockNotificationsService.retryFailed).toHaveBeenCalledWith(3);
    expect(mockMonitoringService.recordQueueProcessingTime).toHaveBeenCalled();
  });

  it('beforeApplicationShutdown should drain runs', async () => {
    mockNotificationsService.retryFailed.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 50));
      return { retried: 1 };
    });
    
    // start handling in background
    const handlePromise = cron.handleRetry();
    // initiate shutdown
    const shutdownPromise = cron.beforeApplicationShutdown();
    
    await Promise.all([handlePromise, shutdownPromise]);
    
    // next run should skip
    await cron.handleRetry();
    expect(mockNotificationsService.retryFailed).toHaveBeenCalledTimes(1);
  });
});
