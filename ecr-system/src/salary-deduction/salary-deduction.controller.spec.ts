import { Test, TestingModule } from '@nestjs/testing';
import { SalaryDeductionController } from './salary-deduction.controller';
import { SalaryDeductionService } from './salary-deduction.service';

describe('SalaryDeductionController', () => {
  let controller: SalaryDeductionController;

  const mockService = {
    create: jest.fn(),
    updateStatus: jest.fn(),
    getByReport: jest.fn(),
    getByOperator: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalaryDeductionController],
      providers: [
        { provide: SalaryDeductionService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<SalaryDeductionController>(SalaryDeductionController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('create should call service', async () => {
    const req = { user: { id: '1', role: 'ADMIN' } };
    const dto = { reportId: 'r1', amount: 100 } as any;
    await controller.create(req, dto);
    expect(mockService.create).toHaveBeenCalledWith(dto, '1', 'ADMIN');
  });

  it('updateStatus should call service', async () => {
    const req = { user: { id: '1', role: 'ADMIN' } };
    const dto = { status: 'PAID' } as any;
    await controller.updateStatus(req, 'd1', dto);
    expect(mockService.updateStatus).toHaveBeenCalledWith('d1', dto, '1', 'ADMIN');
  });

  it('getByReport should call service', async () => {
    await controller.getByReport('r1');
    expect(mockService.getByReport).toHaveBeenCalledWith('r1');
  });

  it('getByOperator should call service', async () => {
    await controller.getByOperator('o1');
    expect(mockService.getByOperator).toHaveBeenCalledWith('o1');
  });
});
