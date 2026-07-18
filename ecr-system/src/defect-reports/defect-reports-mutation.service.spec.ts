import { DefectReportsMutationService } from './defect-reports-mutation.service';
import { BadRequestException } from '@nestjs/common';

describe('DefectReportsMutationService', () => {
  let service: DefectReportsMutationService;
  let reportsRepo: any;
  let inspectionRepo: any;
  let smReviewRepo: any;
  let gmApprovalRepo: any;
  let auditRepo: any;
  let events: any;
  let workflowService: any;

  beforeEach(() => {
    const createMockRepo = () => ({
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((entity: any) => Promise.resolve({ ...entity, id: entity.id || 'new-id' })),
      create: jest.fn().mockImplementation((data: any) => data),
      manager: {
        transaction: jest.fn((fn: any) => fn({
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation((_cls: any, data: any) => data),
          save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
          getRepository: jest.fn().mockReturnValue({
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((data: any) => data),
            save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
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
    workflowService = {
      logStatusChange: jest.fn(),
      emitStatusChange: jest.fn(),
    };

    service = new DefectReportsMutationService(
      reportsRepo,
      inspectionRepo,
      smReviewRepo,
      gmApprovalRepo,
      auditRepo,
      events,
      workflowService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new defect report for OPERATOR role', async () => {
      const dto = {
        component: 'Micrometer',
        errorDescription: 'Calibration drift',
        stageOfFailure: 'Incoming',
        inspectionType: 'REWORK',
      } as any;
      const actor = { id: 'user-1', role: 'OPERATOR' } as any;

      const result = await service.create(dto, actor);
      expect(reportsRepo.manager.transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid role', async () => {
      const dto = { component: 'Test' } as any;
      const actor = { id: 'user-1', role: 'GENERAL_MANAGER' } as any;

      await expect(service.create(dto, actor)).rejects.toThrow(BadRequestException);
    });
  });
});
