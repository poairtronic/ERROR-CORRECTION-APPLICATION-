import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { ComponentIssue } from '../component-issue/component-issue.entity';
import { AuditLog } from '../audit-log/audit-log.entity';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockReportsRepo: any;
  let mockInspectRepo: any;

  beforeEach(async () => {
    mockReportsRepo = {
      count: jest.fn().mockResolvedValue(10),
      sum: jest.fn().mockResolvedValue(5000),
      createQueryBuilder: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    mockInspectRepo = {
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    const mockSmRepo = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ totalCost: 5000, totalLoss: 1000 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(DefectReport), useValue: mockReportsRepo },
        { provide: getRepositoryToken(InspectionDetail), useValue: mockInspectRepo },
        { provide: getRepositoryToken(SmReview), useValue: mockSmRepo },
        { provide: getRepositoryToken(GmApproval), useValue: {} },
        { provide: getRepositoryToken(ComponentIssue), useValue: {} },
        { provide: getRepositoryToken(AuditLog), useValue: {} },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should generate accurate Executive KPIs', async () => {
    const kpis = await service.getExecutiveKpis();
    expect(kpis.totalReports).toBe(10);
    expect(kpis.totalCost).toBe(5000);
    expect(kpis.openReports).toBe(10);
  });

  it('should flag inspection bottlenecks in rule-based insights', async () => {
    mockReportsRepo.count.mockResolvedValue(6); // Trigger bottleneck rule > 5
    const insights = await service.getRuleBasedInsights();
    expect(insights).toContain('Inspection bottleneck detected: 6 reports awaiting inspection.');
  });
});
