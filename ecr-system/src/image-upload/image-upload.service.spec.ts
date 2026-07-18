import { ImageUploadService } from './image-upload.service';
import { BadRequestException } from '@nestjs/common';

// Mock cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    uploader: {
      upload_stream: jest.fn((_opts: any, callback: any) => {
        // Return a mock writable stream
        const stream = {
          on: jest.fn(),
          pipe: jest.fn(),
          end: jest.fn(),
        };
        // Simulate success callback
        setTimeout(() => callback(null, { secure_url: 'https://res.cloudinary.com/test/ecr-system/img1.jpg' }), 10);
        return stream;
      }),
      destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
    },
  },
}));

// Mock streamifier
jest.mock('streamifier', () => ({
  createReadStream: jest.fn().mockReturnValue({
    pipe: jest.fn(),
  }),
}));

describe('ImageUploadService', () => {
  let service: ImageUploadService;

  beforeEach(() => {
    service = new ImageUploadService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateFile (via uploadImage)', () => {
    it('should throw BadRequestException for invalid MIME type', async () => {
      const file = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1000,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      await expect(service.uploadImage(file)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for file too large', async () => {
      const file = {
        originalname: 'large.jpg',
        mimetype: 'image/jpeg',
        size: 6 * 1024 * 1024, // 6MB
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      await expect(service.uploadImage(file)).rejects.toThrow(BadRequestException);
    });

    it('should accept valid JPEG file', () => {
      const file = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1000,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      // Should not throw during validation
      expect(() => (service as any).validateFile(file)).not.toThrow();
    });

    it('should accept valid PNG file', () => {
      const file = {
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 1000,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      expect(() => (service as any).validateFile(file)).not.toThrow();
    });

    it('should accept valid WebP file', () => {
      const file = {
        originalname: 'test.webp',
        mimetype: 'image/webp',
        size: 1000,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      expect(() => (service as any).validateFile(file)).not.toThrow();
    });
  });

  describe('uploadMultipleImages', () => {
    it('should return empty array if no files provided', async () => {
      const result = await service.uploadMultipleImages([]);
      expect(result).toEqual([]);
    });

    it('should return empty array if files is null/undefined', async () => {
      const result = await service.uploadMultipleImages(null as any);
      expect(result).toEqual([]);
    });
  });

  describe('deleteImage', () => {
    it('should extract public ID and delete from cloudinary', async () => {
      const { v2: cloudinary } = require('cloudinary');
      await service.deleteImage('https://res.cloudinary.com/demo/ecr-system/img1.jpg');
      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('ecr-system/img1');
    });

    it('should handle missing URL parts gracefully', async () => {
      // Should not throw
      await expect(service.deleteImage('')).resolves.not.toThrow();
    });
  });
});
