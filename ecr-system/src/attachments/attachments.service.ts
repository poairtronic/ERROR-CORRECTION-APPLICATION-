import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, createReadStream, ReadStream } from 'fs';
import { join } from 'path';
import { ReportAttachment } from './report-attachment.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { CloudinaryService } from './cloudinary.service';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    @InjectRepository(ReportAttachment)
    private readonly attachmentRepo: Repository<ReportAttachment>,
    @InjectRepository(DefectReport)
    private readonly reportRepo: Repository<DefectReport>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async uploadAttachment(
    reportId: string,
    file: Express.Multer.File,
    userId?: string,
  ): Promise<ReportAttachment> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate mime type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }

    // Validate size limit (10MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File too large (maximum allowed size is 10 MB)');
    }

    // Check report existence
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException(`Defect report with ID ${reportId} not found`);
    }

    // Check existing count (max 10 attachments)
    const count = await this.attachmentRepo.count({ where: { reportId } });
    if (count >= 10) {
      throw new BadRequestException('Maximum 10 attachments allowed per report');
    }

    // Upload to Cloudinary with secure local storage fallback
    let uploadResult: { url: string; publicId: string; fileType: string };
    try {
      uploadResult = await this.cloudinaryService.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        reportId,
      );
    } catch (uploadErr: any) {
      this.logger.warn(`Cloudinary upload failed for report ${reportId} (${uploadErr?.message || uploadErr}). Falling back to local storage.`);
      const fileType = file.mimetype.startsWith('image/')
        ? 'image'
        : file.mimetype === 'application/pdf'
        ? 'pdf'
        : 'document';

      const uploadsDir = join(process.cwd(), 'uploads', 'reports', reportId);
      if (!existsSync(uploadsDir)) {
        mkdirSync(uploadsDir, { recursive: true });
      }
      const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const localFilePath = join(uploadsDir, safeName);
      writeFileSync(localFilePath, file.buffer);

      uploadResult = {
        url: `/api/defect-reports/${reportId}/attachments/local-${safeName}/view`,
        publicId: `local:${safeName}`,
        fileType,
      };
    }

    // Save record to DB
    const attachment = this.attachmentRepo.create({
      reportId,
      fileName: file.originalname,
      originalName: file.originalname,
      fileUrl: uploadResult.url,
      publicId: uploadResult.publicId,
      fileType: uploadResult.fileType,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      uploadedById: userId || null,
    });

    const saved = await this.attachmentRepo.save(attachment);
    this.logger.log(`Uploaded attachment ${saved.id} for report ${reportId}`);
    return saved;
  }

  async getAttachments(reportId: string): Promise<ReportAttachment[]> {
    return this.attachmentRepo.find({
      where: { reportId },
      order: { uploadedAt: 'DESC' },
    });
  }

  async getAttachmentFile(
    reportId: string,
    attachmentIdOrPublicId: string,
  ): Promise<{ stream?: ReadStream; mimeType: string; fileName: string; fileUrl?: string }> {
    // Look up by id or publicId
    let attachment: ReportAttachment | null = null;
    if (attachmentIdOrPublicId.startsWith('local-')) {
      const publicId = `local:${attachmentIdOrPublicId.replace(/^local-/, '')}`;
      attachment = await this.attachmentRepo.findOne({
        where: { publicId, reportId },
      });
    } else {
      attachment = await this.attachmentRepo.findOne({
        where: { id: attachmentIdOrPublicId, reportId },
      });
    }

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (attachment.fileUrl?.startsWith('http://') || attachment.fileUrl?.startsWith('https://')) {
      return { mimeType: attachment.mimeType, fileName: attachment.fileName, fileUrl: attachment.fileUrl };
    }

    // Local file fallback
    const safeName = attachment.publicId.replace(/^local:/, '');
    const localFilePath = join(process.cwd(), 'uploads', 'reports', reportId, safeName);
    if (!existsSync(localFilePath)) {
      throw new NotFoundException('Local attachment file not found on disk');
    }

    const stream = createReadStream(localFilePath);
    return { stream, mimeType: attachment.mimeType, fileName: attachment.fileName };
  }

  async deleteAttachment(reportId: string, attachmentId: string): Promise<{ success: boolean; message: string }> {
    const attachment = await this.attachmentRepo.findOne({
      where: { id: attachmentId, reportId },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found for report ${reportId}`);
    }

    // Delete from storage
    if (attachment.publicId?.startsWith('local:')) {
      const safeName = attachment.publicId.replace(/^local:/, '');
      const localFilePath = join(process.cwd(), 'uploads', 'reports', reportId, safeName);
      if (existsSync(localFilePath)) {
        try {
          unlinkSync(localFilePath);
        } catch (e: any) {
          this.logger.warn(`Failed to delete local file: ${e.message}`);
        }
      }
    } else {
      await this.cloudinaryService.deleteFile(attachment.publicId, attachment.fileType);
    }

    // Delete from DB
    await this.attachmentRepo.remove(attachment);
    this.logger.log(`Deleted attachment ${attachmentId} from report ${reportId}`);

    return { success: true, message: 'Attachment deleted successfully' };
  }
}

