import { VendorsController } from './vendors.controller';
import { Repository } from 'typeorm';

describe('VendorsController', () => {
  let controller: VendorsController;
  let mockRepo: Partial<Repository<any>>;

  const mockVendor = { id: 'v-1', name: 'Vendor A', code: 'VA', isActive: true };

  beforeEach(() => {
    mockRepo = {
      find: jest.fn().mockResolvedValue([mockVendor]),
      create: jest.fn().mockReturnValue(mockVendor),
      save: jest.fn().mockResolvedValue(mockVendor),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    controller = new VendorsController(mockRepo as Repository<any>);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll (inherited)', () => {
    it('should return all active vendors', async () => {
      const result = await controller.findAll();
      expect(mockRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });
      expect(result).toEqual([mockVendor]);
    });
  });

  describe('create (inherited)', () => {
    it('should create a vendor', async () => {
      const body = { name: 'Vendor B', code: 'VB' };
      const result = await controller.create(body);
      expect(mockRepo.create).toHaveBeenCalledWith(body);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('update (inherited)', () => {
    it('should update a vendor', async () => {
      const body = { name: 'Updated Vendor' };
      const result = await controller.update('v-1', body);
      expect(mockRepo.save).toHaveBeenCalledWith({ id: 'v-1', name: 'Updated Vendor' });
    });
  });

  describe('deactivate (inherited)', () => {
    it('should deactivate a vendor', async () => {
      const result = await controller.deactivate('v-1');
      expect(mockRepo.update).toHaveBeenCalledWith('v-1', { isActive: false });
    });
  });
});
