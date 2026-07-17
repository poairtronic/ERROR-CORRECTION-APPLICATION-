import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  
  const mockService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('findAll should call service with optional args', async () => {
    await controller.findAll('ADMIN', 'IT');
    expect(mockService.findAll).toHaveBeenCalledWith('ADMIN', 'IT');
  });

  it('findOne should call service', async () => {
    await controller.findOne('1');
    expect(mockService.findOne).toHaveBeenCalledWith('1');
  });

  it('create should call service', async () => {
    const dto = { name: 't', email: 'e', tempPassword: 'p', role: 'ADMIN' as any };
    await controller.create(dto);
    expect(mockService.create).toHaveBeenCalledWith(dto);
  });

  it('update should call service', async () => {
    await controller.update('1', { name: 'n' });
    expect(mockService.update).toHaveBeenCalledWith('1', { name: 'n' });
  });

  it('deactivate should call service', async () => {
    await controller.deactivate('1');
    expect(mockService.deactivate).toHaveBeenCalledWith('1');
  });
});
