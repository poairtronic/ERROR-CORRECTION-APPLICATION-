import { ComponentIssueService } from './component-issue.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ReportStatus } from '../common/enums/report-status.enum';

describe('ComponentIssueService', () => {
  let service: ComponentIssueService;
  let componentIssueRepo: any;
  let componentRepo: any;
  let defectReportRepo: any;
  let auditRepo: any;
  let dataSource: any;
  let events: any;

  const mockComponent = { id: 'comp-1', name: 'Micrometer', code: 'MIC-001', stockQty: 10 };
  const mockReport = { id: 'rpt-1', reportNumber: 'AGIPL-2026-ERR-00001', status: ReportStatus.APPROVED };

  beforeEach(() => {
    const createMockQueryRunner = (reportOverride?: any, componentOverride?: any) => ({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn().mockImplementation((_entity: any, _opts: any) => {
          if (_entity.name === 'DefectReport' || _entity === require('../defect-reports/defect-report.entity').DefectReport) {
            return Promise.resolve(reportOverride !== undefined ? reportOverride : { ...mockReport });
          }
          return Promise.resolve(componentOverride !== undefined ? componentOverride : { ...mockComponent });
        }),
        save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
        create: jest.fn().mockImplementation((_cls: any, data: any) => data),
      },
    });

    componentIssueRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    componentRepo = {};
    defectReportRepo = {};
    auditRepo = {};
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(createMockQueryRunner()),
    };
    events = { emit: jest.fn() };

    service = new ComponentIssueService(
      componentIssueRepo,
      componentRepo,
      defectReportRepo,
      auditRepo,
      dataSource,
      events,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getIssuesByReport', () => {
    it('should return component issues for a report', async () => {
      const mockIssues = [{ id: 'ci-1', reportId: 'rpt-1' }];
      componentIssueRepo.find.mockResolvedValue(mockIssues);

      const result = await service.getIssuesByReport('rpt-1');
      expect(componentIssueRepo.find).toHaveBeenCalledWith({
        where: { reportId: 'rpt-1' },
        relations: ['storeManager', 'issuedTo'],
      });
      expect(result).toEqual(mockIssues);
    });

    it('should return empty array if no issues exist', async () => {
      componentIssueRepo.find.mockResolvedValue([]);
      const result = await service.getIssuesByReport('rpt-999');
      expect(result).toEqual([]);
    });
  });
});
