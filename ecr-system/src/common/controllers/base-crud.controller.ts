import { Get, Post, Patch, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { Repository, ObjectLiteral } from 'typeorm';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
export class BaseCrudController<T extends ObjectLiteral> {
  private static readonly cache = new Map<string, { data: any; expiry: number }>();

  constructor(protected readonly repo: Repository<T>) {}

  private invalidateCache() {
    const prefix = `${this.constructor.name}_`;
    for (const key of BaseCrudController.cache.keys()) {
      if (key.startsWith(prefix)) {
        BaseCrudController.cache.delete(key);
      }
    }
  }

  @Get()
  async findAll(@Query() pagination?: import('../dto/pagination.dto').PaginationDto) {
    const hasPagination = pagination && (pagination.page !== undefined || pagination.limit !== undefined || pagination.sort !== undefined);
    const cacheKey = `${this.constructor.name}_${JSON.stringify(pagination || {})}`;
    const cached = BaseCrudController.cache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiry > now) {
      return cached.data;
    }

    let data: any;
    if (!hasPagination) {
      data = await this.repo.find({ where: { isActive: true } as any });
    } else {
      const page = pagination.page ? Number(pagination.page) : 1;
      const limit = pagination.limit ? Math.min(Number(pagination.limit), 100) : 50;
      const skip = (page - 1) * limit;

      const order: any = {};
      if (pagination.sort) {
        order[pagination.sort] = pagination.order || 'ASC';
      }

      data = await this.repo.find({
        where: { isActive: true } as any,
        skip,
        take: limit,
        ...(Object.keys(order).length > 0 ? { order } : {}),
      });
    }

    if (BaseCrudController.cache.size > 100) {
      const cacheNow = Date.now();
      for (const [key, val] of BaseCrudController.cache.entries()) {
        if (val.expiry <= cacheNow) {
          BaseCrudController.cache.delete(key);
        }
      }
      if (BaseCrudController.cache.size > 100) {
        const firstKey = BaseCrudController.cache.keys().next().value;
        if (firstKey) {
          BaseCrudController.cache.delete(firstKey);
        }
      }
    }

    BaseCrudController.cache.set(cacheKey, { data, expiry: now + 10000 }); // 10 seconds cache
    return data;
  }

  @Post()
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  async create(@Body() body: Partial<T>) {
    const result = await this.repo.save(this.repo.create(body as any));
    this.invalidateCache();
    return result;
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  async update(@Param('id') id: string, @Body() body: Partial<T>) {
    const result = await this.repo.save({ id, ...body } as any);
    this.invalidateCache();
    return result;
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async deactivate(@Param('id') id: string) {
    const result = await this.repo.update(id as any, { isActive: false } as any);
    this.invalidateCache();
    return result;
  }
}
