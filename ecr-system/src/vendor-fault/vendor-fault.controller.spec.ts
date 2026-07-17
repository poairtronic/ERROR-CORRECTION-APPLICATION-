import { Test, TestingModule } from '@nestjs/testing';
import { VendorFaultController } from './vendor-fault.controller';
import { VendorFaultService } from './vendor-fault.service';

describe('VendorFaultController', () => {
  let controller: VendorFaultController;

  const mockService = {
    create: jest.fn(),
    update: jest.fn(),
    getByReport: jest.fn(),
    getByVendor: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorFaultController],
      providers: [
        { provide: VendorFaultService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<VendorFaultController>(VendorFaultController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('create should call service', async () => {
    const req = { user: { id: '1', role: 'ADMIN' } };
    const dto = { reportId: 'r1', vendorId: 'v1' } as any;
    await controller.create(req, dto);
    expect(mockService.create).toHaveBeenCalledWith(dto, '1', 'ADMIN');
  });

  it('update should call service', async () => {
    const req = { user: { id: '1', role: 'ADMIN' } };
    const dto = { recoveryAmount: 100 } as any;
    await controller.update(req, 'f1', dto);
    expect(mockService.update).toHaveBeenCalledWith('f1', dto, '1', 'ADMIN');
  });

  it('getByReport should call service', async () => {
    await controller.getByReport('r1');
    expect(mockService.getByReport).toHaveBeenCalledWith('r1');
  });

  it('getByVendor should call service', async () => {
    await controller.getByVendor('v1');
    expect(mockService.getByVendor).toHaveBeenCalledWith('v1');
  });
});
