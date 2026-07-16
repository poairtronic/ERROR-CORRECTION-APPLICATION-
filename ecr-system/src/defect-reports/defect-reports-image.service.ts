import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DefectReport } from './defect-report.entity';
import { AuditLog, AuditActionType } from '../audit-log/audit-log.entity';
import { ImageUploadService } from '../image-upload/image-upload.service';
import { ActingUser } from './defect-reports.service';

@Injectable()
export class DefectReportsImageService {
  constructor(
    @InjectRepository(DefectReport)
    private readonly reportsRepo: Repository<DefectReport>,
    private readonly imageUploadService: ImageUploadService,
  ) {}

  async uploadImages(reportId: string, files: Express.Multer.File[], actor: ActingUser) {
    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);
      const auditRepo = manager.getRepository(AuditLog);

      const report = await reportsRepo.findOne({ 
        where: { id: reportId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!report) throw new NotFoundException('Defect report not found');
      
      const urls = await this.imageUploadService.uploadMultipleImages(files);
      
      const oldImages = [...report.images];
      report.images.push(...urls);
      
      await reportsRepo.save(report);
      
      await auditRepo.save(
        auditRepo.create({
          reportId: report.id,
          actorId: actor.id,
          actorRole: actor.role,
          actionType: AuditActionType.IMAGE_UPLOADED,
          fieldName: 'images',
          oldValue: JSON.stringify(oldImages),
          newValue: JSON.stringify(report.images),
          note: `Uploaded ${files.length} images`,
        }),
      );
      
      return report;
    });
  }

  async deleteImage(reportId: string, imageUrl: string, actor: ActingUser) {
    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);
      const auditRepo = manager.getRepository(AuditLog);

      const report = await reportsRepo.findOne({ 
        where: { id: reportId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!report) throw new NotFoundException('Defect report not found');
      
      if (!report.images.includes(imageUrl)) {
        throw new BadRequestException('Image not found in report');
      }
      
      await this.imageUploadService.deleteImage(imageUrl);
      
      const oldImages = [...report.images];
      report.images = report.images.filter(img => img !== imageUrl);
      
      await reportsRepo.save(report);
      
      await auditRepo.save(
        auditRepo.create({
          reportId: report.id,
          actorId: actor.id,
          actorRole: actor.role,
          actionType: AuditActionType.FIELD_EDIT,
          fieldName: 'images',
          oldValue: JSON.stringify(oldImages),
          newValue: JSON.stringify(report.images),
          note: `Deleted image`,
        }),
      );
      
      return report;
    });
  }
}
