import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AuditLogService, AuditLogFilterDto } from './audit-log.service';

@Controller(['audit-logs', 'audit'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.GENERAL_MANAGER, Role.SENIOR_MANAGER)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async findAll(@Query() query: AuditLogFilterDto) {
    return this.auditLogService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const log = await this.auditLogService.findOne(id);
    if (!log) {
      throw new NotFoundException(`Audit log entry with ID "${id}" not found`);
    }
    return log;
  }
}

