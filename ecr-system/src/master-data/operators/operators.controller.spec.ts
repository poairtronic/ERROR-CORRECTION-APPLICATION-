import { OperatorsController } from './operators.controller';
import { Repository } from 'typeorm';

describe('OperatorsController', () => {
  let controller: OperatorsController;
  let mockRepo: Partial<Repository<any>>;

  const mockOperator = { id: 'op-1', name: 'John Doe', code: 'JD', isActive: true };

  beforeEach(() => {
    mockRepo = {
      find: jest.fn().mockResolvedValue([mockOperator]),
      create: jest.fn().mockReturnValue(mockOperator),
      save: jest.fn().mockResolvedValue(mockOperator),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    controller = new OperatorsController(mockRepo as Repository<any>);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should findAll active operators', async () => {
    const result = await controller.findAll();
    expect(mockRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(result).toEqual([mockOperator]);
  });

  it('should create an operator', async () => {
    const body = { name: 'Jane Smith', code: 'JS' };
    await controller.create(body);
    expect(mockRepo.create).toHaveBeenCalledWith(body);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should update an operator', async () => {
    await controller.update('op-1', { name: 'John Updated' });
    expect(mockRepo.save).toHaveBeenCalledWith({ id: 'op-1', name: 'John Updated' });
  });

  it('should deactivate an operator', async () => {
    await controller.deactivate('op-1');
    expect(mockRepo.update).toHaveBeenCalledWith('op-1', { isActive: false });
  });
});
