import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ComponentIssueService } from './component-issue.service';
import { CreateComponentIssueDto } from './dto/create-component-issue.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('component-issue')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComponentIssueController {
  constructor(private readonly componentIssueService: ComponentIssueService) {}

  @Post()
  @Roles(Role.STORE_MANAGER)
  async issueComponents(@Req() req: any, @Body() dto: CreateComponentIssueDto) {
    const storeManagerId = req.user.id;
    return this.componentIssueService.issueComponents(storeManagerId, dto);
  }

  @Get('report/:reportId')
  @Roles(Role.STORE_MANAGER, Role.SENIOR_MANAGER, Role.GENERAL_MANAGER, Role.INSPECTOR)
  async getIssuesByReport(@Param('reportId') reportId: string) {
    return this.componentIssueService.getIssuesByReport(reportId);
  }
}
