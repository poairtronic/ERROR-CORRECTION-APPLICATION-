import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

describe('MonitoringController', () => {
  let controller: MonitoringController;
  let service: Partial<MonitoringService>;

  beforeEach(() => {
    service = {
      getMetrics: jest.fn().mockReturnValue({
        uptime: 3600,
        requestCount: 500,
        avgResponseTime: 120,
        errorRate: 0.02,
      }),
    };
    controller = new MonitoringController(service as MonitoringService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should return monitoring metrics', () => {
      const result = controller.getDashboard();
      expect(service.getMetrics).toHaveBeenCalled();
      expect(result).toEqual({
        uptime: 3600,
        requestCount: 500,
        avgResponseTime: 120,
        errorRate: 0.02,
      });
    });
  });
});
