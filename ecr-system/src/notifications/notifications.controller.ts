import { Controller, Get, Patch, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  findMine(
    @CurrentUser() user,
    @Query('unread') unread?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (page !== undefined || limit !== undefined) {
      const pageNum = Number(page) || 1;
      const limitNum = Math.min(Number(limit) || 50, 100);
      return this.service.findForUser(user.id, unread === 'true', pageNum, limitNum);
    }
    return this.service.findForUser(user.id, unread === 'true');
  }

  @Get('report/:reportId')
  async findByReport(
    @Param('reportId') reportId: string,
    @CurrentUser() user,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const hasAccess = await this.service.canAccessReportNotifications(reportId, user.id, user.role);
    if (!hasAccess) throw new NotFoundException('Notifications not found');
    if (page !== undefined || limit !== undefined) {
      const pageNum = Number(page) || 1;
      const limitNum = Math.min(Number(limit) || 50, 100);
      return this.service.findByReport(reportId, pageNum, limitNum);
    }
    return this.service.findByReport(reportId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.service.markRead(id);
  }
}
