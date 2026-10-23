import {
  Body,
  Controller,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { InternalService } from './internal.service';
import { InternalSecretGuard } from './guards/internal-secret.guard';
import { RmIntakeDto } from './dto/rm-intake.dto';
import { ReportStatus } from '../common/enums/report-status.enum';
import { DefectReportsWorkflowService } from '../defect-reports/defect-reports-workflow.service';

@Controller('internal')
export class InternalController {
  constructor(
    private readonly internalService: InternalService,
    private readonly workflowService: DefectReportsWorkflowService,
  ) {}

  @Post('rm-intake')
  @UseGuards(InternalSecretGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async intakeFromRm(@Body() dto: RmIntakeDto) {
    const result = await this.internalService.createFromRM(dto);

    // Fetch the full saved report to pass to emitStatusChange
    const savedReport = await this.internalService.findById(result.reportId);

    this.workflowService.emitStatusChange(
      savedReport,
      ReportStatus.DRAFT,
      { id: null, name: dto.raisedByName, role: 'OPERATOR' } as any,
      'Report raised from RM App',
      'Auto-created from V-SMART Rework Module',
    );

    return result;
  }
}
