import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CostRate } from './cost-rate.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('master-data/cost-rates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CostRatesController {
  constructor(@InjectRepository(CostRate) private repo: Repository<CostRate>) {}

  @Get()
  findAll() {
    return this.repo.find({ where: { isActive: true } });
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() body: Partial<CostRate>) {
    return this.repo.save(this.repo.create(body));
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() body: Partial<CostRate>) {
    return this.repo.save({ id, ...body });
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.repo.update(id, { isActive: false });
  }
}
