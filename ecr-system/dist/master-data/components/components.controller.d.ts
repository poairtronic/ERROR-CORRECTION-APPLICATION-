import { Repository } from 'typeorm';
import { Component } from './component.entity';
import { BaseCrudController } from '../../common/controllers/base-crud.controller';
export declare class ComponentsController extends BaseCrudController<Component> {
    constructor(repo: Repository<Component>);
}
