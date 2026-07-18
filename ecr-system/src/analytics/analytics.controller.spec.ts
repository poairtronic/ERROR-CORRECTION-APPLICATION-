import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: Partial<AnalyticsService>;

  beforeEach(() => {
    service = {
      getExecutiveKpis: jest.fn().mockResolvedValue({ totalReports: 50, openReports: 10 }),
      getTrends: jest.fn().mockResolvedValue([{ month: 'Jan', count: 5 }]),
      getRootCauses: jest.fn().mockResolvedValue([{ cause: 'Calibration', count: 12 }]),
      getRuleBasedInsights: jest.fn().mockResolvedValue([{ insight: 'High defect rate on Machine A' }]),
      getVendorIntelligence: jest.fn().mockResolvedValue([{ vendor: 'Vendor A', defects: 3 }]),
      getOperatorIntelligence: jest.fn().mockResolvedValue([{ operator: 'Op1', errors: 2 }]),
      getMachineIntelligence: jest.fn().mockResolvedValue([{ machine: 'M1', issues: 5 }]),
      getSlaMetrics: jest.fn().mockResolvedValue({ avgResolutionDays: 3.5 }),
    };
    controller = new AnalyticsController(service as AnalyticsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get executive KPIs', async () => {
    const result = await controller.getExecutiveKpis();
    expect(service.getExecutiveKpis).toHaveBeenCalled();
    expect(result).toEqual({ totalReports: 50, openReports: 10 });
  });

  it('should get trends', async () => {
    const result = await controller.getTrends();
    expect(service.getTrends).toHaveBeenCalled();
    expect(result).toEqual([{ month: 'Jan', count: 5 }]);
  });

  it('should get root causes', async () => {
    const result = await controller.getRootCauses();
    expect(service.getRootCauses).toHaveBeenCalled();
    expect(result).toEqual([{ cause: 'Calibration', count: 12 }]);
  });

  it('should get rule-based insights', async () => {
    const result = await controller.getRuleBasedInsights();
    expect(service.getRuleBasedInsights).toHaveBeenCalled();
  });

  it('should get vendor intelligence', async () => {
    const result = await controller.getVendorIntelligence();
    expect(service.getVendorIntelligence).toHaveBeenCalled();
  });

  it('should get operator intelligence', async () => {
    const result = await controller.getOperatorIntelligence();
    expect(service.getOperatorIntelligence).toHaveBeenCalled();
  });

  it('should get machine intelligence', async () => {
    const result = await controller.getMachineIntelligence();
    expect(service.getMachineIntelligence).toHaveBeenCalled();
  });

  it('should get SLA metrics', async () => {
    const result = await controller.getSlaMetrics();
    expect(service.getSlaMetrics).toHaveBeenCalled();
    expect(result).toEqual({ avgResolutionDays: 3.5 });
  });
});
