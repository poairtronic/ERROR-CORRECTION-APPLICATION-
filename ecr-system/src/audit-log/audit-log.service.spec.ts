import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLog, AuditActionType } from './audit-log.entity';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let mockRepo: any;

  beforeEach(async () => {
    mockRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should query and map audit logs', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'log-1',
            actionType: AuditActionType.STATUS_CHANGE,
            note: 'Initial draft',
            report: { id: 'rep-1', reportNumber: 'AGIPL-2026-ERR-00001' },
            actor: { name: 'Operator' },
          },
        ]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll({ search: 'draft', actionType: 'STATUS_CHANGE' });

      expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('audit');
      expect(result).toHaveLength(1);
      expect(result[0].reportNumber).toBe('AGIPL-2026-ERR-00001');
      expect(result[0].notes).toBe('Initial draft');
    });
  });

  describe('findOne', () => {
    it('should find one audit log by ID', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'log-1',
        note: 'Note test',
        report: { reportNumber: 'AGIPL-001' },
      });

      const result = await service.findOne('log-1');
      expect(mockRepo.findOne).toHaveBeenCalled();
      expect(result?.reportNumber).toBe('AGIPL-001');
    });

    it('should return null if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.findOne('non-existent');
      expect(result).toBeNull();
    });
  });
});

