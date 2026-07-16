import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { SalaryDeductionService } from './salary-deduction.service';
import { SalaryDeduction } from './salary-deduction.entity';
import { AuditLog, AuditActionType } from '../audit-log/audit-log.entity';
import { User } from '../users/user.entity';
import { Role } from '../common/enums/role.enum';

describe('SalaryDeductionService', () => {
  let service: SalaryDeductionService;
  let deductionRepo: Repository<SalaryDeduction>;
  let auditRepo: Repository<AuditLog>;
  let userRepo: Repository<User>;
  let eventEmitter: EventEmitter2;

  const mockDeductionRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((record) => Promise.resolve({ id: 'deduction-uuid', ...record })),
    manager: {
      transaction: jest.fn(),
    },
  };

  const mockAuditRepo = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn().mockImplementation((record) => Promise.resolve({ id: 'audit-uuid', ...record })),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalaryDeductionService,
        {
          provide: getRepositoryToken(SalaryDeduction),
          useValue: mockDeductionRepo,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<SalaryDeductionService>(SalaryDeductionService);
    deductionRepo = module.get<Repository<SalaryDeduction>>(getRepositoryToken(SalaryDeduction));
    auditRepo = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // Setup transaction mock
    const mockManager = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === SalaryDeduction) return mockDeductionRepo;
        if (entity === AuditLog) return mockAuditRepo;
        if (entity === User) return mockUserRepo;
      }),
    };
    deductionRepo.manager.transaction = jest.fn().mockImplementation(async (cb) => cb(mockManager));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a salary deduction and log audit actions', async () => {
      const dto = {
        reportId: 'report-123',
        operatorId: 'operator-123',
        amount: 250,
        reason: 'Rework cost',
        monthRef: '2026-07',
      };

      const result = await service.create(dto, 'actor-123', Role.STORE_MANAGER);

      expect(result).toBeDefined();
      expect(result.id).toBe('deduction-uuid');
      expect(result.amount).toBe(250);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('salary.deduction.created', expect.any(Object));
    });
  });

  describe('handleOperatorFault', () => {
    it('should resolve operator by UUID correctly', async () => {
      const validUuid = '12345678-1234-1234-1234-123456789012';
      const payload = {
        report: {
          id: 'report-123',
          reportNumber: 'ERR-001',
          inspectionDetail: {
            responsibleId: validUuid,
            lossAmount: 500,
          },
          smReview: {
            decisionNote: 'Operator error standard',
          },
        },
        gmId: 'gm-123',
      };

      mockUserRepo.findOne.mockResolvedValueOnce({ id: validUuid, email: 'operator@velan.com' });

      await service.handleOperatorFault(payload);

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({ where: { id: validUuid } });
      expect(mockDeductionRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        operatorId: validUuid,
        amount: 500,
      }));
    });

    it('should fall back to email lookup when not a UUID', async () => {
      const payload = {
        report: {
          id: 'report-123',
          reportNumber: 'ERR-001',
          inspectionDetail: {
            responsibleId: 'operator@velan.com',
            lossAmount: 300,
          },
          smReview: {},
        },
        gmId: 'gm-123',
      };

      mockUserRepo.findOne.mockResolvedValueOnce({ id: 'resolved-operator-uuid', email: 'operator@velan.com' });

      await service.handleOperatorFault(payload);

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({ where: { email: 'operator@velan.com' } });
      expect(mockDeductionRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        operatorId: 'resolved-operator-uuid',
      }));
    });

    it('should fall back to null operatorId if user lookup fails completely', async () => {
      const payload = {
        report: {
          id: 'report-123',
          reportNumber: 'ERR-001',
          inspectionDetail: {
            responsibleId: 'unknown-operator',
            lossAmount: 100,
          },
          smReview: {},
        },
        gmId: 'gm-123',
      };

      mockUserRepo.findOne.mockResolvedValue(null); // All fallbacks return null

      await service.handleOperatorFault(payload);

      expect(mockDeductionRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        operatorId: undefined, // undefined maps to null in DB save
      }));
    });
  });
});
