import { Controller } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operator } from './operator.entity';
import { BaseCrudController } from '../../common/controllers/base-crud.controller';

@Controller('master-data/operators')
export class OperatorsController extends BaseCrudController<Operator> {
  constructor(@InjectRepository(Operator) repo: Repository<Operator>) {
    super(repo);
  }
}
