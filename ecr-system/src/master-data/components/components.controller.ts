import { Controller } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Component } from './component.entity';
import { BaseCrudController } from '../../common/controllers/base-crud.controller';

@Controller('master-data/components')
export class ComponentsController extends BaseCrudController<Component> {
  constructor(@InjectRepository(Component) repo: Repository<Component>) {
    super(repo);
  }
}
