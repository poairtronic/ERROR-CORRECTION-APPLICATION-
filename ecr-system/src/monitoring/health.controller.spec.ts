import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { MonitoringService } from './monitoring.service';

describe('HealthController', () => {
  let controller: HealthController;

  const mockService = {
    getHealthMetrics: jest.fn(),
    checkDatabaseHealth: jest.fn(),
  };

  const mockResponse = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: MonitoringService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('getHealth should return 200 OK when health metrics report healthy', async () => {
    mockService.getHealthMetrics.mockResolvedValue({ status: 'healthy' });
    const res = mockResponse();
    await controller.getHealth(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'healthy' });
  });

  it('getHealth should return 503 SERVICE_UNAVAILABLE when health metrics report unhealthy or degraded', async () => {
    mockService.getHealthMetrics.mockResolvedValue({ status: 'unhealthy' });
    const res = mockResponse();
    await controller.getHealth(res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ status: 'unhealthy' });
  });

  it('getLive should return 200 OK with in-memory uptime and timestamp without database dependency', () => {
    const res = mockResponse();
    controller.getLive(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'live',
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      }),
    );
    expect(mockService.checkDatabaseHealth).not.toHaveBeenCalled();
    expect(mockService.getHealthMetrics).not.toHaveBeenCalled();
  });

  it('getReady should return 200 OK if db is healthy', async () => {
    mockService.checkDatabaseHealth.mockResolvedValue({ status: 'healthy' });
    const res = mockResponse();
    await controller.getReady(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'ready', database: { status: 'healthy' } });
  });

  it('getReady should return 503 SERVICE_UNAVAILABLE if db is unhealthy', async () => {
    mockService.checkDatabaseHealth.mockResolvedValue({ status: 'unhealthy' });
    const res = mockResponse();
    await controller.getReady(res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ status: 'unready', database: { status: 'unhealthy' } });
  });
});
