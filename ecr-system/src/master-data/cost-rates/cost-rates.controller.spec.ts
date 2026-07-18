import { CostRatesController } from './cost-rates.controller';
import { Repository } from 'typeorm';

describe('CostRatesController', () => {
  let controller: CostRatesController;
  let mockRepo: Partial<Repository<any>>;

  const mockRate = { id: 'cr-1', stageName: 'Standard Rate', ratePerHour: 150, isActive: true };

  beforeEach(() => {
    mockRepo = {
      find: jest.fn().mockResolvedValue([mockRate]),
      create: jest.fn().mockReturnValue(mockRate),
      save: jest.fn().mockResolvedValue(mockRate),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    controller = new CostRatesController(mockRepo as Repository<any>);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should findAll active cost rates', async () => {
    const result = await controller.findAll();
    expect(mockRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(result).toEqual([mockRate]);
  });

  it('should create a cost rate', async () => {
    const body = { stageName: 'Premium Rate', ratePerHour: 200 };
    await controller.create(body);
    expect(mockRepo.create).toHaveBeenCalledWith(body);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should update a cost rate', async () => {
    await controller.update('cr-1', { ratePerHour: 175 });
    expect(mockRepo.save).toHaveBeenCalledWith({ id: 'cr-1', ratePerHour: 175 });
  });

  it('should deactivate a cost rate', async () => {
    await controller.deactivate('cr-1');
    expect(mockRepo.update).toHaveBeenCalledWith('cr-1', { isActive: false });
  });
});
