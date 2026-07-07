import { Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { Repository, ObjectLiteral } from 'typeorm';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
export class BaseCrudController<T extends ObjectLiteral> {
  constructor(protected readonly repo: Repository<T>) {}

  @Get()
  findAll() {
    return this.repo.find({ where: { isActive: true } as any });
  }

  @Post()
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  create(@Body() body: Partial<T>) {
    return this.repo.save(this.repo.create(body as any));
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  update(@Param('id') id: string, @Body() body: Partial<T>) {
    return this.repo.save({ id, ...body } as any);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.repo.update(id as any, { isActive: false } as any);
  }
}
