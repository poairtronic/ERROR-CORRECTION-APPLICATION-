import { DefectReportsWorkflowService } from './defect-reports-workflow.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('DefectReportsWorkflowService', () => {
  let service: DefectReportsWorkflowService;
  let reportsRepo: any;
  let inspectionRepo: any;
  let smReviewRepo: any;
  let gmApprovalRepo: any;
  let auditRepo: any;
  let events: any;

  const mockReport = {
    id: 'rpt-1',
    reportNumber: 'AGIPL-2026-ERR-00001',
    status: 'NEW_PRODUCTION',
    raisedById: 'user-1',
    raisedBy: { id: 'user-1', name: 'Operator1' },
    inspectionDetail: null,
    smReview: null,
    gmApproval: null,
  };

  beforeEach(() => {
    const createMockRepo = () => ({
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
      create: jest.fn().mockImplementation((data: any) => data),
      manager: {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn(),
          find: jest.fn(),
          save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
          create: jest.fn().mockImplementation((data: any) => data),
        }),
        transaction: jest.fn((fn: any) => fn({
          getRepository: jest.fn().mockReturnValue({
            findOne: jest.fn().mockResolvedValue(mockReport),
            save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
            create: jest.fn().mockImplementation((data: any) => data),
          }),
        })),
      },
    });

    reportsRepo = createMockRepo();
    inspectionRepo = createMockRepo();
    smReviewRepo = createMockRepo();
    gmApprovalRepo = createMockRepo();
    auditRepo = createMockRepo();
    events = { emit: jest.fn() };

    service = new DefectReportsWorkflowService(
      reportsRepo,
      inspectionRepo,
      smReviewRepo,
      gmApprovalRepo,
      auditRepo,
      events,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logStatusChange', () => {
    it('should create an audit log entry', async () => {
      const actor = { id: 'user-1', role: 'INSPECTOR' } as any;
      await service.logStatusChange('rpt-1', actor, 'NEW_PRODUCTION' as any, 'PENDING_INSPECTION' as any, 'Submitted');
      expect(auditRepo.save).toHaveBeenCalled();
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'rpt-1',
          actorId: 'user-1',
          actorRole: 'INSPECTOR',
        }),
      );
    });

    it('should use provided manager repository if given', async () => {
      const mockManager = {
        getRepository: jest.fn().mockReturnValue({
          save: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockImplementation((data: any) => data),
        }),
      } as any;
      const actor = { id: 'user-1', role: 'INSPECTOR' } as any;
      await service.logStatusChange('rpt-1', actor, 'NEW_PRODUCTION' as any, 'PENDING_INSPECTION' as any, 'test', mockManager);
      expect(mockManager.getRepository).toHaveBeenCalled();
    });
  });

  describe('emitStatusChange', () => {
    it('should emit report.status.changed event', () => {
      const report = { ...mockReport, status: 'PENDING_INSPECTION' } as any;
      const actor = { id: 'user-1', role: 'INSPECTOR' } as any;
      service.emitStatusChange(report, 'NEW_PRODUCTION' as any, actor, 'Submitted', 'Initial submission');
      expect(events.emit).toHaveBeenCalledWith(
        'report.status.changed',
        expect.objectContaining({
          reportId: 'rpt-1',
          status: 'PENDING_INSPECTION',
          fromStatus: 'NEW_PRODUCTION',
        }),
      );
    });

    it('should not throw if event emission fails', () => {
      events.emit.mockImplementation(() => { throw new Error('Event error'); });
      const report = { ...mockReport } as any;
      // Should swallow the error
      expect(() => service.emitStatusChange(report, 'DRAFT' as any)).not.toThrow();
    });
  });
});
