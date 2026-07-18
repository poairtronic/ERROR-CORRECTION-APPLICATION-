import { DefectReportsImageService } from './defect-reports-image.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('DefectReportsImageService', () => {
  let service: DefectReportsImageService;
  let reportsRepo: any;
  let imageUploadService: any;

  const mockReport = {
    id: 'rpt-1',
    images: ['https://cloudinary.com/img1.jpg'],
  };

  beforeEach(() => {
    imageUploadService = {
      uploadMultipleImages: jest.fn().mockResolvedValue(['https://cloudinary.com/new1.jpg']),
      deleteImage: jest.fn().mockResolvedValue(undefined),
    };

    const createMockManager = (reportOverride?: any) => ({
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(reportOverride !== undefined ? reportOverride : { ...mockReport, images: [...mockReport.images] }),
        save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
        create: jest.fn().mockImplementation((data: any) => data),
      }),
    });

    reportsRepo = {
      manager: {
        transaction: jest.fn((fn: any) => fn(createMockManager())),
      },
    };

    service = new DefectReportsImageService(reportsRepo, imageUploadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadImages', () => {
    it('should upload images and append URLs to report', async () => {
      const files = [{ originalname: 'test.jpg', buffer: Buffer.from('test'), mimetype: 'image/jpeg', size: 100 }] as any;
      const actor = { id: 'user-1', role: 'OPERATOR' } as any;

      await service.uploadImages('rpt-1', files, actor);
      expect(imageUploadService.uploadMultipleImages).toHaveBeenCalledWith(files);
    });

    it('should throw NotFoundException if report not found', async () => {
      reportsRepo.manager.transaction = jest.fn((fn: any) => fn({
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn().mockResolvedValue(null),
          save: jest.fn(),
          create: jest.fn(),
        }),
      }));

      const files = [] as any;
      const actor = { id: 'user-1', role: 'OPERATOR' } as any;

      await expect(service.uploadImages('rpt-999', files, actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteImage', () => {
    it('should delete image from report and cloudinary', async () => {
      const actor = { id: 'user-1', role: 'OPERATOR' } as any;
      await service.deleteImage('rpt-1', 'https://cloudinary.com/img1.jpg', actor);
      expect(imageUploadService.deleteImage).toHaveBeenCalledWith('https://cloudinary.com/img1.jpg');
    });

    it('should throw BadRequestException if image not found in report', async () => {
      const actor = { id: 'user-1', role: 'OPERATOR' } as any;
      await expect(
        service.deleteImage('rpt-1', 'https://cloudinary.com/nonexistent.jpg', actor),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
