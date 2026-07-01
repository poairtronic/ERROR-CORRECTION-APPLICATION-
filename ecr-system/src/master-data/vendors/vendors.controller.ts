import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor } from './vendor.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('master-data/vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorsController {
  constructor(@InjectRepository(Vendor) private repo: Repository<Vendor>) {}

  @Get()
  findAll() {
    return this.repo.find({ where: { isActive: true } });
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() body: Partial<Vendor>) {
    return this.repo.save(this.repo.create(body));
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() body: Partial<Vendor>) {
    return this.repo.save({ id, ...body });
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.repo.update(id, { isActive: false });
  }
}
