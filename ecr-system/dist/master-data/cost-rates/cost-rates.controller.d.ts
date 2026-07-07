import { Repository } from 'typeorm';
import { CostRate } from './cost-rate.entity';
import { BaseCrudController } from '../../common/controllers/base-crud.controller';
export declare class CostRatesController extends BaseCrudController<CostRate> {
    constructor(repo: Repository<CostRate>);
}
