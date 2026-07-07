import { Repository } from 'typeorm';
import { ErrorType } from './error-type.entity';
import { BaseCrudController } from '../../common/controllers/base-crud.controller';
export declare class ErrorTypesController extends BaseCrudController<ErrorType> {
    constructor(repo: Repository<ErrorType>);
}
