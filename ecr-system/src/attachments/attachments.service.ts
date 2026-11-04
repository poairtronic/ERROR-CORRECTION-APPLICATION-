import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    // Upload to Cloudinary
    let uploadResult: { url: string; publicId: string; fileType: string };
    try {
      uploadResult = await this.cloudinaryService.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        reportId,
      );
    } catch (uploadErr: any) {
      this.logger.error(`Cloudinary upload failed for report ${reportId}: ${uploadErr?.message || uploadErr}`);
      const errorMsg = uploadErr?.message || '';
      if (errorMsg.includes('403') || errorMsg.includes('permission') || errorMsg.includes('actions=["create"]')) {
        throw new BadRequestException(
          'Cloudinary upload rejected: API key lacks "create/upload" permissions. In Cloudinary Console -> Settings -> Access Keys, ensure "Create/Upload" is checked or use the Master Key.',
        );
      }
      throw new BadRequestException(`Cloudinary upload failed: ${errorMsg || 'Unable to store file'}`);
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

  async deleteAttachment(reportId: string, attachmentId: string): Promise<{ success: boolean; message: string }> {
    const attachment = await this.attachmentRepo.findOne({
      where: { id: attachmentId, reportId },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found for report ${reportId}`);
    }

    // Delete from Cloudinary
    await this.cloudinaryService.deleteFile(attachment.publicId, attachment.fileType);

    // Delete from DB
    await this.attachmentRepo.remove(attachment);
    this.logger.log(`Deleted attachment ${attachmentId} from report ${reportId}`);

    return { success: true, message: 'Attachment deleted successfully' };
  }
}

