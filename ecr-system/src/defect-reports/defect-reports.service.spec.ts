import { DefectReportsService } from './defect-reports.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('DefectReportsService', () => {
  let service: DefectReportsService;
  let reportsRepo: any;
  let inspectionRepo: any;
  let smReviewRepo: any;
  let gmApprovalRepo: any;
  let auditRepo: any;
  let events: any;
  let workflowService: any;
  let imageService: any;
  let mutationService: any;

  const mockReport = {
    id: 'rpt-1',
    reportNumber: 'AGIPL-2026-ERR-00001',
    status: 'DRAFT',
    raisedById: 'user-1',
    raisedBy: { id: 'user-1', name: 'TestUser' },
  };

  beforeEach(() => {
    reportsRepo = {
      findOne: jest.fn().mockResolvedValue(mockReport),
      find: jest.fn().mockResolvedValue([mockReport]),
      save: jest.fn().mockResolvedValue(mockReport),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockReport], 1]),
        andWhere: jest.fn().mockReturnThis(),
      }),
      manager: {
        transaction: jest.fn((fn) => fn({
          findOne: jest.fn().mockResolvedValue({ id: 'AGIPL', lastValue: 0 }),
          create: jest.fn((cls, data) => data),
          save: jest.fn().mockResolvedValue({ id: 'AGIPL', lastValue: 1 }),
          getRepository: jest.fn().mockReturnValue({
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          }),
        })),
      },
    };
    inspectionRepo = {};
    smReviewRepo = {};
    gmApprovalRepo = {};
    auditRepo = {};
    events = { emit: jest.fn() };
    workflowService = {
      inspect: jest.fn().mockResolvedValue(mockReport),
      smReview: jest.fn().mockResolvedValue(mockReport),
      gmApprove: jest.fn().mockResolvedValue(mockReport),
      transitionStatus: jest.fn().mockResolvedValue(mockReport),
      issueComponents: jest.fn().mockResolvedValue(mockReport),
      editField: jest.fn().mockResolvedValue(mockReport),
    };
    imageService = {
      uploadImages: jest.fn().mockResolvedValue(mockReport),
      deleteImage: jest.fn().mockResolvedValue(mockReport),
    };
    mutationService = {
      create: jest.fn().mockResolvedValue(mockReport),
      update: jest.fn().mockResolvedValue(mockReport),
    };

    service = new DefectReportsService(
      reportsRepo,
      inspectionRepo,
      smReviewRepo,
      gmApprovalRepo,
      auditRepo,
      events,
      workflowService,
      imageService,
      mutationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should delegate to mutationService', async () => {
      const dto = { component: 'Test' } as any;
      const actor = { id: 'user-1', role: 'OPERATOR' } as any;
      await service.create(dto, actor);
      expect(mutationService.create).toHaveBeenCalledWith(dto, actor);
    });
  });

  describe('update', () => {
    it('should delegate to mutationService', async () => {
      const dto = { component: 'Updated' } as any;
      const actor = { id: 'user-1', role: 'OPERATOR' } as any;
      await service.update('rpt-1', dto, actor);
      expect(mutationService.update).toHaveBeenCalledWith('rpt-1', dto, actor);
    });
  });

  describe('findOne', () => {
    it('should return a report by id', async () => {
      reportsRepo.findOne.mockResolvedValue({ ...mockReport, status: 'NEW_PRODUCTION' });
      const result = await service.findOne('rpt-1', { id: 'user-1' });
      expect(reportsRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'rpt-1' } }));
    });

    it('should throw NotFoundException if report not found', async () => {
      reportsRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('rpt-999', { id: 'user-1' })).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if DRAFT report accessed by non-raiser', async () => {
      reportsRepo.findOne.mockResolvedValue({ ...mockReport, status: 'DRAFT', raisedById: 'user-1' });
      await expect(service.findOne('rpt-1', { id: 'user-other' })).rejects.toThrow(ForbiddenException);
    });
  });
});
