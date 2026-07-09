import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { EmailMonitoringService } from './email-monitoring.service';

@Controller('email-monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class EmailMonitoringController {
  constructor(private readonly monitoringService: EmailMonitoringService) {}

  @Get('summary')
  getSummary() {
    return this.monitoringService.getSummary();
  }

  @Get('list')
  list(@Query() query: any) {
    return this.monitoringService.list(query);
  }

  @Get('export')
  async export(@Query() query: any, @Res() res: Response) {
    const csvContent = await this.monitoringService.exportToCsv(query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="email-logs-export.csv"');
    return res.status(200).send(csvContent);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.monitoringService.findOne(id);
  }

  @Post(':id/resend')
  resend(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    return this.monitoringService.resend(id, req.user, reason || 'Manual Admin Resend');
  }

  @Post(':id/retry')
  retry(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    return this.monitoringService.retry(id, req.user, reason || 'Manual Admin Retry');
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    return this.monitoringService.cancel(id, req.user, reason || 'Manual Admin Cancellation');
  }
}
