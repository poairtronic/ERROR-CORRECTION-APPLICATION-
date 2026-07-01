import { Repository } from 'typeorm';
import { Vendor } from './vendor.entity';
export declare class VendorsController {
    private repo;
    constructor(repo: Repository<Vendor>);
    findAll(): Promise<Vendor[]>;
    create(body: Partial<Vendor>): Promise<Vendor>;
    update(id: string, body: Partial<Vendor>): Promise<{
        id: string;
        name?: string | undefined;
        contactEmail?: string | undefined;
        contactPhone?: string | undefined;
        isActive?: boolean | undefined;
    } & Vendor>;
    deactivate(id: string): Promise<import("typeorm").UpdateResult>;
}
