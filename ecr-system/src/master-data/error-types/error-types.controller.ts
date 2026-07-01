import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorType } from './error-type.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('master-data/error-types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ErrorTypesController {
  constructor(@InjectRepository(ErrorType) private repo: Repository<ErrorType>) {}

  @Get()
  findAll() {
    return this.repo.find({ where: { isActive: true } });
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() body: { name: string; description?: string }) {
    return this.repo.save(this.repo.create(body));
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() body: Partial<ErrorType>) {
    return this.repo.save({ id, ...body });
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.repo.update(id, { isActive: false });
  }
}
