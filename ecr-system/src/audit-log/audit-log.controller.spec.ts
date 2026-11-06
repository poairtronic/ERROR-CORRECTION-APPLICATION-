import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let service: Partial<AuditLogService>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([
        { id: '1', reportNumber: 'AGIPL-001', notes: 'Created' },
      ]),
      findOne: jest.fn().mockImplementation((id: string) => {
        if (id === '1') {
          return Promise.resolve({ id: '1', reportNumber: 'AGIPL-001', notes: 'Created' });
        }
        return Promise.resolve(null);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        {
          provide: AuditLogService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<AuditLogController>(AuditLogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all audit logs from service', async () => {
      const result = await controller.findAll({});
      expect(service.findAll).toHaveBeenCalledWith({});
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return the found audit log', async () => {
      const result = await controller.findOne('1');
      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });

    it('should throw NotFoundException if audit log not found', async () => {
      await expect(controller.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});

