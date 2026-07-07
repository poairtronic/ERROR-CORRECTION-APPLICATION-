import { Repository } from 'typeorm';
import { Vendor } from './vendor.entity';
import { BaseCrudController } from '../../common/controllers/base-crud.controller';
export declare class VendorsController extends BaseCrudController<Vendor> {
    constructor(repo: Repository<Vendor>);
}
