import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VendorFaultService } from './vendor-fault.service';
import { VendorFaultLog } from './vendor-fault-log.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { RecoveryStatus } from '../common/enums/report-status.enum';

describe('VendorFaultService', () => {
  let service: VendorFaultService;
  
  const mockManager = {
    getRepository: jest.fn(),
  };

  const mockFaultRepo = {
    manager: { transaction: jest.fn(cb => cb(mockManager)) },
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockAuditRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    mockManager.getRepository.mockImplementation((entity) => {
      if (entity === VendorFaultLog) return mockFaultRepo;
      if (entity === AuditLog) return mockAuditRepo;
      return null;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorFaultService,
        { provide: getRepositoryToken(VendorFaultLog), useValue: mockFaultRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditRepo },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<VendorFaultService>(VendorFaultService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create should save fault, log audit and emit event', async () => {
    const dto = { reportId: 'r1', vendorId: 'v1', note: 'test' };
    mockFaultRepo.create.mockReturnValue({ ...dto, id: 'f1' });
    mockFaultRepo.save.mockResolvedValue({ ...dto, id: 'f1' });
    mockAuditRepo.create.mockReturnValue({});
    
    await service.create(dto as any, 'a1', 'GM');
    
    expect(mockFaultRepo.save).toHaveBeenCalled();
    expect(mockAuditRepo.save).toHaveBeenCalled();
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('vendor.fault.created', expect.any(Object));
  });

  it('update should modify recoveryStatus and recoveryAmount', async () => {
    const record = { id: 'f1', reportId: 'r1', recoveryStatus: RecoveryStatus.PENDING, recoveryAmount: 0 };
    mockFaultRepo.findOne.mockResolvedValue(record);
    mockAuditRepo.create.mockReturnValue({});
    mockFaultRepo.save.mockResolvedValue(record);

    await service.update('f1', { recoveryStatus: RecoveryStatus.RECOVERED, recoveryAmount: 100, note: 'add' } as any, 'a1', 'GM');
    
    expect(record.recoveryStatus).toBe(RecoveryStatus.RECOVERED);
    expect(record.recoveryAmount).toBe(100);
    expect(mockAuditRepo.save).toHaveBeenCalledTimes(2);
    expect(mockFaultRepo.save).toHaveBeenCalled();
  });

  it('update should throw NotFoundException if not found', async () => {
    mockFaultRepo.findOne.mockResolvedValue(null);
    await expect(service.update('f1', {}, 'a1', 'GM')).rejects.toThrow(NotFoundException);
  });

  it('getByReport should return records', async () => {
    mockFaultRepo.find.mockResolvedValue([]);
    await service.getByReport('r1');
    expect(mockFaultRepo.find).toHaveBeenCalledWith({ where: { reportId: 'r1' }, relations: ['vendor'] });
  });

  it('getByVendor should return records', async () => {
    mockFaultRepo.find.mockResolvedValue([]);
    await service.getByVendor('v1');
    expect(mockFaultRepo.find).toHaveBeenCalledWith({ where: { vendorId: 'v1' }, relations: ['report'] });
  });

  it('handleVendorFault should create fault log automatically', async () => {
    const payload = {
      report: { id: 'r1', reportNumber: '123', inspectionDetail: { responsibleId: 'v1' } },
      gmId: 'g1'
    };
    mockFaultRepo.create.mockReturnValue({ id: 'f1', vendorId: 'v1', reportId: 'r1' });
    mockFaultRepo.save.mockResolvedValue({ id: 'f1', vendorId: 'v1', reportId: 'r1' });

    await service.handleVendorFault(payload);
    
    expect(mockFaultRepo.save).toHaveBeenCalled();
    expect(mockAuditRepo.save).toHaveBeenCalled();
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('vendor.fault.created', expect.any(Object));
  });

  it('handleVendorFault should not create if vendorId missing', async () => {
    const payload = {
      report: { id: 'r1', reportNumber: '123' },
      gmId: 'g1'
    };
    await service.handleVendorFault(payload);
    expect(mockFaultRepo.save).not.toHaveBeenCalled();
  });
});
