import { Controller, Post, Patch, Get, Param, Body, UseGuards, Req } from '@nestjs/common';
import { SalaryDeductionService } from './salary-deduction.service';
import { CreateSalaryDeductionDto, UpdateSalaryDeductionStatusDto } from './dto/salary-deduction.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('salary-deduction')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalaryDeductionController {
  constructor(private readonly deductionService: SalaryDeductionService) {}

  @Post()
  @Roles(Role.SENIOR_MANAGER, Role.GENERAL_MANAGER, Role.ADMIN)
  async create(@Req() req: any, @Body() dto: CreateSalaryDeductionDto) {
    return this.deductionService.create(dto, req.user.id, req.user.role);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.GENERAL_MANAGER)
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSalaryDeductionStatusDto,
  ) {
    return this.deductionService.updateStatus(id, dto, req.user.id, req.user.role);
  }

  @Get('report/:reportId')
  @Roles(Role.SENIOR_MANAGER, Role.GENERAL_MANAGER, Role.ADMIN, Role.INSPECTOR)
  async getByReport(@Param('reportId') reportId: string) {
    return this.deductionService.getByReport(reportId);
  }

  @Get('operator/:operatorId')
  @Roles(Role.ADMIN, Role.GENERAL_MANAGER)
  async getByOperator(@Param('operatorId') operatorId: string) {
    return this.deductionService.getByOperator(operatorId);
  }
}
