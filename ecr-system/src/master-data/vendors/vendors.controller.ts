import { Controller } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor } from './vendor.entity';
import { BaseCrudController } from '../../common/controllers/base-crud.controller';

@Controller('master-data/vendors')
export class VendorsController extends BaseCrudController<Vendor> {
  constructor(@InjectRepository(Vendor) repo: Repository<Vendor>) {
    super(repo);
  }
}
