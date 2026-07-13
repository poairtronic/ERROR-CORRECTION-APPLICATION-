import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('kpis')
  @Roles(Role.ADMIN, Role.GENERAL_MANAGER, Role.SENIOR_MANAGER, Role.SALES)
  getExecutiveKpis() {
    return this.analyticsService.getExecutiveKpis();
  }

  @Get('trends')
  @Roles(Role.ADMIN, Role.GENERAL_MANAGER, Role.SENIOR_MANAGER, Role.SALES)
  getTrends() {
    return this.analyticsService.getTrends();
  }

  @Get('root-causes')
  @Roles(Role.ADMIN, Role.GENERAL_MANAGER, Role.SENIOR_MANAGER)
  getRootCauses() {
    return this.analyticsService.getRootCauses();
  }

  @Get('insights')
  @Roles(Role.ADMIN, Role.GENERAL_MANAGER, Role.SENIOR_MANAGER)
  getRuleBasedInsights() {
    return this.analyticsService.getRuleBasedInsights();
  }

  @Get('vendor-intelligence')
  @Roles(Role.ADMIN, Role.GENERAL_MANAGER, Role.SENIOR_MANAGER, Role.INSPECTOR)
  getVendorIntelligence() {
    return this.analyticsService.getVendorIntelligence();
  }

  @Get('operator-intelligence')
  @Roles(Role.ADMIN, Role.GENERAL_MANAGER, Role.SENIOR_MANAGER)
  getOperatorIntelligence() {
    return this.analyticsService.getOperatorIntelligence();
  }

  @Get('machine-intelligence')
  @Roles(Role.ADMIN, Role.GENERAL_MANAGER, Role.SENIOR_MANAGER, Role.INSPECTOR)
  getMachineIntelligence() {
    return this.analyticsService.getMachineIntelligence();
  }

  @Get('sla')
  @Roles(Role.ADMIN, Role.GENERAL_MANAGER, Role.SENIOR_MANAGER)
  getSlaMetrics() {
    return this.analyticsService.getSlaMetrics();
  }}
