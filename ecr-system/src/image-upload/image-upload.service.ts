import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class ImageUploadService {
  constructor() {
    // Cloudinary config should ideally come from ConfigService
    // For now, it will pick up CLOUDINARY_URL from env if set, or we can set it explicitly.
    // cloudinary.config({
    //   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    //   api_key: process.env.CLOUDINARY_API_KEY,
    //   api_secret: process.env.CLOUDINARY_API_SECRET,
    // });
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    this.validateFile(file);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'ecr-system',
          resource_type: 'image',
          quality: 'auto:good', // Compression
        },
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async uploadMultipleImages(files: Express.Multer.File[]): Promise<string[]> {
    if (!files || files.length === 0) return [];
    
    const uploadPromises = files.map((file) => this.uploadImage(file));
    return Promise.all(uploadPromises);
  }

  async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Extract public ID from URL: e.g. https://res.cloudinary.com/.../ecr-system/abc.jpg -> ecr-system/abc
      const parts = imageUrl.split('/');
      const filename = parts.pop();
      const folder = parts.pop();
      if (!filename || !folder) return;
      
      const publicId = `${folder}/${filename.split('.')[0]}`;
      await cloudinary.uploader.destroy(publicId);
    } catch (e) {
      console.error('Failed to delete image from Cloudinary', e);
    }
  }

  private validateFile(file: Express.Multer.File) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type: ${file.mimetype}. Allowed: jpg, jpeg, png, webp`);
    }

    if (file.size > maxSize) {
      throw new BadRequestException(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max size is 5MB.`);
    }
  }
}
