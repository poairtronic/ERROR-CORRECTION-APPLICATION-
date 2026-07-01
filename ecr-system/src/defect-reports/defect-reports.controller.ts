import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Delete,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { DefectReportsService } from './defect-reports.service';
import { CreateDefectReportDto } from './dto/create-defect-report.dto';
import { InspectReportDto } from './dto/inspect-report.dto';
import { SmReviewDto } from './dto/sm-review.dto';
import { GmApproveDto } from './dto/gm-approve.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('defect-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DefectReportsController {
  constructor(private service: DefectReportsService) {}

  @Post()
  @Roles(Role.OPERATOR, Role.INSPECTOR, Role.SENIOR_MANAGER)
  create(@Body() dto: CreateDefectReportDto, @CurrentUser() user) {
    return this.service.create(dto, user);
  }

  // all roles can read; row-level scoping (own vs all) applied in service/query later phases
  @Get()
  findAll(@Query('status') status?: string, @Query('mine') mine?: string, @CurrentUser() user?) {
    return this.service.findAll({
      status,
      raisedById: mine === 'true' ? user?.id : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/inspect')
  @Roles(Role.INSPECTOR)
  inspect(@Param('id') id: string, @Body() dto: InspectReportDto, @CurrentUser() user) {
    return this.service.inspect(id, dto, user);
  }

  @Patch(':id/sm-review')
  @Roles(Role.SENIOR_MANAGER)
  smReview(@Param('id') id: string, @Body() dto: SmReviewDto, @CurrentUser() user) {
    return this.service.smReview(id, dto, user);
  }

  @Patch(':id/gm-approve')
  @Roles(Role.GENERAL_MANAGER)
  gmApprove(@Param('id') id: string, @Body() dto: GmApproveDto, @CurrentUser() user) {
    return this.service.gmApprove(id, dto, user);
  }

  @Patch(':id/field')
  @Roles(Role.SENIOR_MANAGER, Role.GENERAL_MANAGER)
  editField(
    @Param('id') id: string,
    @Body() body: { field: string; value: string },
    @CurrentUser() user,
  ) {
    return this.service.editField(id, body.field, body.value, user);
  }

  @Post(':id/images')
  @Roles(Role.OPERATOR, Role.INSPECTOR, Role.SENIOR_MANAGER)
  @UseInterceptors(FilesInterceptor('files', 5)) // max 5 files
  async uploadImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user,
  ) {
    return this.service.uploadImages(id, files, user);
  }

  @Delete(':id/images')
  @Roles(Role.OPERATOR, Role.INSPECTOR, Role.SENIOR_MANAGER)
  async deleteImage(
    @Param('id') id: string,
    @Body() body: { imageUrl: string },
    @CurrentUser() user,
  ) {
    return this.service.deleteImage(id, body.imageUrl, user);
  }

  @Patch(':id/status')
  @Roles(Role.SENIOR_MANAGER, Role.GENERAL_MANAGER)
  async transitionStatus(
    @Param('id') id: string,
    @Body() body: { status: string; note: string },
    @CurrentUser() user,
  ) {
    // import ReportStatus internally or assume string is valid since service validates
    return this.service.transitionStatus(id, body.status as any, body.note, user);
  }
}
