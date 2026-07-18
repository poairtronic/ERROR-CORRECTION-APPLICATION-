import { DefectReportsController } from './defect-reports.controller';
import { DefectReportsService } from './defect-reports.service';

describe('DefectReportsController', () => {
  let controller: DefectReportsController;
  let service: Partial<DefectReportsService>;

  const mockUser = { id: 'user-1', role: 'OPERATOR', username: 'testuser' };
  const mockReport = { id: 'rpt-1', reportNumber: 'AGIPL-2026-ERR-00001', status: 'DRAFT' };

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(mockReport),
      update: jest.fn().mockResolvedValue({ ...mockReport, status: 'NEW_PRODUCTION' }),
      findAll: jest.fn().mockResolvedValue({ items: [mockReport], total: 1 }),
      findOne: jest.fn().mockResolvedValue(mockReport),
      inspect: jest.fn().mockResolvedValue({ ...mockReport, status: 'PENDING_ACCOUNTS_REVIEW' }),
      smReview: jest.fn().mockResolvedValue({ ...mockReport, status: 'PENDING_GM_APPROVAL' }),
      gmApprove: jest.fn().mockResolvedValue({ ...mockReport, status: 'APPROVED' }),
      editField: jest.fn().mockResolvedValue(mockReport),
      uploadImages: jest.fn().mockResolvedValue({ ...mockReport, imageUrls: ['url1'] }),
      deleteImage: jest.fn().mockResolvedValue(mockReport),
      transitionStatus: jest.fn().mockResolvedValue({ ...mockReport, status: 'CLOSED' }),
      issueComponents: jest.fn().mockResolvedValue({ ...mockReport, status: 'COMPONENTS_ISSUED' }),
    };
    controller = new DefectReportsController(service as DefectReportsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a defect report', async () => {
      const dto = { component: 'Micrometer', errorDescription: 'Drift' } as any;
      const result = await controller.create(dto, mockUser);
      expect(service.create).toHaveBeenCalledWith(dto, mockUser);
      expect(result).toEqual(mockReport);
    });
  });

  describe('update', () => {
    it('should update a defect report', async () => {
      const dto = { component: 'Micrometer Updated' } as any;
      const result = await controller.update('rpt-1', dto, mockUser);
      expect(service.update).toHaveBeenCalledWith('rpt-1', dto, mockUser);
    });
  });

  describe('findAll', () => {
    it('should return paginated reports', async () => {
      const result = await controller.findAll(undefined, undefined, 1, 10, mockUser);
      expect(service.findAll).toHaveBeenCalledWith({
        status: undefined,
        raisedById: undefined,
        page: 1,
        limit: 10,
      });
      expect(result).toEqual({ items: [mockReport], total: 1 });
    });

    it('should filter by mine=true', async () => {
      await controller.findAll(undefined, 'true', undefined, undefined, mockUser);
      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ raisedById: 'user-1' }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single report', async () => {
      const result = await controller.findOne('rpt-1', mockUser);
      expect(service.findOne).toHaveBeenCalledWith('rpt-1', mockUser);
      expect(result).toEqual(mockReport);
    });
  });

  describe('inspect', () => {
    it('should call service.inspect', async () => {
      const dto = { summary: 'Found drift', rootCause: 'Wear' } as any;
      await controller.inspect('rpt-1', dto, mockUser);
      expect(service.inspect).toHaveBeenCalledWith('rpt-1', dto, mockUser);
    });
  });

  describe('smReview', () => {
    it('should call service.smReview', async () => {
      const dto = { decision: 'APPROVE', notes: 'OK' } as any;
      await controller.smReview('rpt-1', dto, mockUser);
      expect(service.smReview).toHaveBeenCalledWith('rpt-1', dto, mockUser);
    });
  });

  describe('gmApprove', () => {
    it('should call service.gmApprove', async () => {
      const dto = { approved: true, remarks: 'Approved' } as any;
      await controller.gmApprove('rpt-1', dto, mockUser);
      expect(service.gmApprove).toHaveBeenCalledWith('rpt-1', dto, mockUser);
    });
  });

  describe('editField', () => {
    it('should call service.editField', async () => {
      await controller.editField('rpt-1', { field: 'priority', value: 'HIGH' }, mockUser);
      expect(service.editField).toHaveBeenCalledWith('rpt-1', 'priority', 'HIGH', mockUser);
    });
  });

  describe('editFields', () => {
    it('should call service.editField for each field and return updated report', async () => {
      const body = { fields: [{ field: 'priority', value: 'HIGH' }, { field: 'notes', value: 'test' }] };
      await controller.editFields('rpt-1', body, mockUser);
      expect(service.editField).toHaveBeenCalledTimes(2);
      expect(service.findOne).toHaveBeenCalledWith('rpt-1', mockUser);
    });
  });

  describe('uploadImages', () => {
    it('should call service.uploadImages', async () => {
      const files = [{ originalname: 'test.jpg', buffer: Buffer.from('test'), mimetype: 'image/jpeg', size: 100 }] as any;
      await controller.uploadImages('rpt-1', files, mockUser);
      expect(service.uploadImages).toHaveBeenCalledWith('rpt-1', files, mockUser);
    });
  });

  describe('deleteImage', () => {
    it('should call service.deleteImage', async () => {
      await controller.deleteImage('rpt-1', { imageUrl: 'https://cloudinary.com/test.jpg' }, mockUser);
      expect(service.deleteImage).toHaveBeenCalledWith('rpt-1', 'https://cloudinary.com/test.jpg', mockUser);
    });
  });

  describe('transitionStatus', () => {
    it('should call service.transitionStatus', async () => {
      await controller.transitionStatus('rpt-1', { status: 'CLOSED', note: 'Done' }, mockUser);
      expect(service.transitionStatus).toHaveBeenCalledWith('rpt-1', 'CLOSED', 'Done', mockUser);
    });
  });

  describe('issueComponents', () => {
    it('should call service.issueComponents', async () => {
      await controller.issueComponents('rpt-1', { remarks: 'Issued 3 parts' }, mockUser);
      expect(service.issueComponents).toHaveBeenCalledWith('rpt-1', { remarks: 'Issued 3 parts' }, mockUser);
    });
  });
});
