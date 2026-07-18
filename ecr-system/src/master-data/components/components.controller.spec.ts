import { ComponentsController } from './components.controller';
import { Repository } from 'typeorm';

describe('ComponentsController', () => {
  let controller: ComponentsController;
  let mockRepo: Partial<Repository<any>>;

  const mockComponent = { id: 'c-1', name: 'Micrometer', code: 'MIC-001', isActive: true };

  beforeEach(() => {
    mockRepo = {
      find: jest.fn().mockResolvedValue([mockComponent]),
      create: jest.fn().mockReturnValue(mockComponent),
      save: jest.fn().mockResolvedValue(mockComponent),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    controller = new ComponentsController(mockRepo as Repository<any>);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should findAll active components', async () => {
    const result = await controller.findAll();
    expect(mockRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(result).toEqual([mockComponent]);
  });

  it('should create a component', async () => {
    const body = { name: 'New Part', code: 'NP-001' };
    await controller.create(body);
    expect(mockRepo.create).toHaveBeenCalledWith(body);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should update a component', async () => {
    const body = { name: 'Updated Part' };
    await controller.update('c-1', body);
    expect(mockRepo.save).toHaveBeenCalledWith({ id: 'c-1', name: 'Updated Part' });
  });

  it('should deactivate a component', async () => {
    await controller.deactivate('c-1');
    expect(mockRepo.update).toHaveBeenCalledWith('c-1', { isActive: false });
  });
});
