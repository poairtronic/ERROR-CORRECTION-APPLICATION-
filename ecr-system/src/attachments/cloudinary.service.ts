import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinaryLib } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private cloudinary: typeof cloudinaryLib;

  constructor(private readonly configService?: ConfigService) {
    const cloudName = this.configService?.get<string>('CLOUDINARY_CLOUD_NAME') || process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = this.configService?.get<string>('CLOUDINARY_API_KEY') || process.env.CLOUDINARY_API_KEY;
    const apiSecret = this.configService?.get<string>('CLOUDINARY_API_SECRET') || process.env.CLOUDINARY_API_SECRET;

    cloudinaryLib.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
    this.cloudinary = cloudinaryLib;
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    reportId: string,
  ): Promise<{ url: string; publicId: string; fileType: string }> {
    // Determine resource type and folder
    const resourceType: 'image' | 'raw' = mimeType.startsWith('image/') ? 'image' : 'raw';
    const fileType = mimeType.startsWith('image/')
      ? 'image'
      : mimeType === 'application/pdf'
      ? 'pdf'
      : 'document';

    const folder = `ecr-reports/${reportId}`;

    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          use_filename: true,
          unique_filename: true,
        },
        (error: any, result: any) => {
          if (error) {
            this.logger.error(`Cloudinary upload failed: ${error.message || JSON.stringify(error)}`);
            return reject(error);
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            fileType,
          });
        },
      );
      uploadStream.end(buffer);
    });
  }

  async deleteFile(publicId: string, fileType: string): Promise<void> {
    const resourceType: 'image' | 'raw' = fileType === 'image' ? 'image' : 'raw';
    try {
      await this.cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
    } catch (err: any) {
      this.logger.error(`Failed to destroy Cloudinary file ${publicId}: ${err.message}`);
    }
  }
}

