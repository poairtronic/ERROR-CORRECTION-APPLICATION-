import { Controller, Post, Patch, Get, Param, Body, UseGuards, Req } from '@nestjs/common';
import { VendorFaultService } from './vendor-fault.service';
import { CreateVendorFaultDto, UpdateVendorFaultDto } from './dto/vendor-fault.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('vendor-fault')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorFaultController {
  constructor(private readonly faultService: VendorFaultService) {}

  @Post()
  @Roles(Role.SENIOR_MANAGER, Role.GENERAL_MANAGER)
  async create(@Req() req: any, @Body() dto: CreateVendorFaultDto) {
    return this.faultService.create(dto, req.user.id, req.user.role);
  }

  @Patch(':id')
  @Roles(Role.SENIOR_MANAGER, Role.GENERAL_MANAGER, Role.ADMIN)
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateVendorFaultDto,
  ) {
    return this.faultService.update(id, dto, req.user.id, req.user.role);
  }

  @Get('report/:reportId')
  @Roles(Role.SENIOR_MANAGER, Role.GENERAL_MANAGER, Role.ADMIN, Role.INSPECTOR)
  async getByReport(@Param('reportId') reportId: string) {
    return this.faultService.getByReport(reportId);
  }

  @Get('vendor/:vendorId')
  @Roles(Role.SENIOR_MANAGER, Role.GENERAL_MANAGER, Role.ADMIN)
  async getByVendor(@Param('vendorId') vendorId: string) {
    return this.faultService.getByVendor(vendorId);
  }
}
