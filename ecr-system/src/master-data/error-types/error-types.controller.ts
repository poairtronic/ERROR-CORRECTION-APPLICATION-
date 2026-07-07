import { Controller } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorType } from './error-type.entity';
import { BaseCrudController } from '../../common/controllers/base-crud.controller';

@Controller('master-data/error-types')
export class ErrorTypesController extends BaseCrudController<ErrorType> {
  constructor(@InjectRepository(ErrorType) repo: Repository<ErrorType>) {
    super(repo);
  }
}
