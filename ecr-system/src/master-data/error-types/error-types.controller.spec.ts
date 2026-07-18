import { ErrorTypesController } from './error-types.controller';
import { Repository } from 'typeorm';

describe('ErrorTypesController', () => {
  let controller: ErrorTypesController;
  let mockRepo: Partial<Repository<any>>;

  const mockErrorType = { id: 'et-1', name: 'Calibration Drift', code: 'CAL', isActive: true };

  beforeEach(() => {
    mockRepo = {
      find: jest.fn().mockResolvedValue([mockErrorType]),
      create: jest.fn().mockReturnValue(mockErrorType),
      save: jest.fn().mockResolvedValue(mockErrorType),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    controller = new ErrorTypesController(mockRepo as Repository<any>);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should findAll active error types', async () => {
    const result = await controller.findAll();
    expect(mockRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(result).toEqual([mockErrorType]);
  });

  it('should create an error type', async () => {
    const body = { name: 'Wear', code: 'WEAR' };
    await controller.create(body);
    expect(mockRepo.create).toHaveBeenCalledWith(body);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should update an error type', async () => {
    await controller.update('et-1', { name: 'Updated Drift' });
    expect(mockRepo.save).toHaveBeenCalledWith({ id: 'et-1', name: 'Updated Drift' });
  });

  it('should deactivate an error type', async () => {
    await controller.deactivate('et-1');
    expect(mockRepo.update).toHaveBeenCalledWith('et-1', { isActive: false });
  });
});
