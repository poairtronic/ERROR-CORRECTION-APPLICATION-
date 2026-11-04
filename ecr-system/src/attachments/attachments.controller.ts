import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';

@Controller(['defect-reports', 'reports'])
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post(':reportId/attachments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSPECTOR, Role.OPERATOR, Role.SENIOR_MANAGER, Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, callback) => {
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (!allowedTypes.includes(file.mimetype)) {
          return callback(new BadRequestException('File type not allowed'), false);
        }
        callback(null, true);
      },
    }),
  )
  async uploadAttachment(
    @Param('reportId') reportId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided or file upload failed');
    }
    const userId = user?.id || user?.sub;
    return this.attachmentsService.uploadAttachment(reportId, file, userId);
  }

  @Get(':reportId/attachments')
  @UseGuards(JwtAuthGuard)
  async getAttachments(@Param('reportId') reportId: string) {
    return this.attachmentsService.getAttachments(reportId);
  }

  @Get(':reportId/attachments/:id/view')
  async viewAttachment(
    @Param('reportId') reportId: string,
    @Param('id') attachmentId: string,
    @Res() res: Response,
  ) {
    const fileData = await this.attachmentsService.getAttachmentFile(reportId, attachmentId);
    if (fileData.fileUrl && (fileData.fileUrl.startsWith('http://') || fileData.fileUrl.startsWith('https://'))) {
      return res.redirect(fileData.fileUrl);
    }
    if (!fileData.stream) {
      throw new NotFoundException('Attachment file not available');
    }
    res.setHeader('Content-Type', fileData.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileData.fileName)}"`);
    fileData.stream.pipe(res);
  }

  @Delete(':reportId/attachments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSPECTOR, Role.OPERATOR, Role.SENIOR_MANAGER, Role.ADMIN)
  async deleteAttachment(
    @Param('reportId') reportId: string,
    @Param('id') attachmentId: string,
  ) {
    return this.attachmentsService.deleteAttachment(reportId, attachmentId);
  }
}

