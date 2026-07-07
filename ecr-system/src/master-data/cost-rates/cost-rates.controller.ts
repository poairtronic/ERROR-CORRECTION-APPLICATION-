import { Controller } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CostRate } from './cost-rate.entity';
import { BaseCrudController } from '../../common/controllers/base-crud.controller';

@Controller('master-data/cost-rates')
export class CostRatesController extends BaseCrudController<CostRate> {
  constructor(@InjectRepository(CostRate) repo: Repository<CostRate>) {
    super(repo);
  }
}
